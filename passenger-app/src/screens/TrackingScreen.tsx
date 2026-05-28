/**
 * TrackingScreen — Real-time driver tracking.
 *
 * Polls order status every 3 seconds.
 * WebSocket for the driver's GPS position and geofencing trigger.
 *
 * Preimage flow:
 *   1. Load from Zustand store (if we are in the same session)
 *   2. Fallback: load from SecureStore (if the app was restarted)
 *   3. If not found -> show a warning + cancel button
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ordersApi, OsmMap } from '@crypgo/shared';
import type { OsmMapRef, OsmMarker } from '@crypgo/shared';
import { useWebSocket } from '@crypgo/shared';
import * as ExpoLocation from 'expo-location';
import { useAuthStore }  from '@/store/useAuthStore';
import { useOrderStore } from '@/store/useOrderStore';
import { loadPreimage, clearPreimage } from '@/services/preimageService';
import type { AppStackParamList, AppNavProp } from '@/navigation/types';

type Route = RouteProp<AppStackParamList, 'Tracking'>;

const SOFIA = { lat: 42.6977, lng: 23.3219 };

export default function TrackingScreen() {
  const navigation      = useNavigation<AppNavProp>();
  const { params }      = useRoute<Route>();
  const accessToken     = useAuthStore((s) => s.accessToken);
  const currentOrder    = useOrderStore((s) => s.currentOrder);
  const pendingInvoice  = useOrderStore((s) => s.pendingInvoice);
  const setCurrentOrder = useOrderStore((s) => s.setCurrentOrder);
  const clearOrder      = useOrderStore((s) => s.clear);

  const mapRef     = useRef<OsmMapRef>(null);
  const mountedRef = useRef(true);

  const [myLocation,       setMyLocation]        = useState<{ lat: number; lng: number } | null>(null);
  const [driverPos,        setDriverPos]        = useState<{ lat: number; lng: number } | null>(null);
  const [completing,       setCompleting]        = useState(false);
  const [geofenceHit,      setGeofenceHit]       = useState(false);
  const [restoredPreimage, setRestoredPreimage]  = useState<string | null>(null);
  // true while SecureStore loads — do not show the missing-preimage UI while waiting
  const [preimageLoading,  setPreimageLoading]   = useState(true);

  // GPS — passenger's own position (direct expo-location, no race condition)
  useEffect(() => {
    let sub: ExpoLocation.LocationSubscription | null = null;
    let mounted = true;

    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;
      sub = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.Balanced, timeInterval: 4_000, distanceInterval: 10 },
        (loc) => { if (mounted) setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }); },
      );
    })();

    return () => { mounted = false; sub?.remove(); };
  }, []);

  // Load preimage from SecureStore on mount
  useEffect(() => {
    const fromStore = pendingInvoice?.preimage ?? null;
    if (fromStore) {
      // Already in the Zustand store — no need to read from SecureStore
      setPreimageLoading(false);
      return;
    }

    // Fallback: attempt to read from SecureStore (survives app restart)
    loadPreimage(params.orderId).then((p) => {
      if (__DEV__) {
        console.log(`[TrackingScreen] SecureStore preimage for ${params.orderId.slice(0, 8)}…:`,
          p ? `${p.slice(0, 8)}… (намерен ✓)` : 'null (не е намерен)');
      }
      if (p) setRestoredPreimage(p);
      setPreimageLoading(false);
    });
  }, [params.orderId]);

  // Tracks whether we've already shown the cancel-request dialog
  // (the request stays on the order until the passenger responds).
  const cancelDialogShownRef = useRef(false);

  // Polling — order status (every 3 seconds)
  useEffect(() => {
    mountedRef.current = true;

    const fetchOrder = async () => {
      try {
        const o = await ordersApi.findOne(params.orderId);
        if (!mountedRef.current) return;
        setCurrentOrder(o);

        // Driver requested cancel during IN_PROGRESS — prompt passenger ONCE
        if (
          o.status === 'IN_PROGRESS' &&
          o.cancel_requested_at &&
          !cancelDialogShownRef.current
        ) {
          cancelDialogShownRef.current = true;
          Alert.alert(
            'Шофьорът иска да анулира',
            'Шофьорът поиска анулиране на курса. Ако потвърдите, плащането ще бъде върнато. Ако откажете, курсът продължава.',
            [
              {
                text: 'Откажи (продължи курса)',
                style: 'cancel',
                onPress: async () => {
                  try {
                    await ordersApi.respondCancel(params.orderId, false);
                    // Re-arm so a future request triggers another prompt
                    cancelDialogShownRef.current = false;
                  } catch (err: any) {
                    Alert.alert('Грешка', err?.response?.data?.message ?? 'Грешка при отговор.');
                    cancelDialogShownRef.current = false;
                  }
                },
              },
              {
                text: 'Потвърди анулиране',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await ordersApi.respondCancel(params.orderId, true);
                  } catch (err: any) {
                    Alert.alert('Грешка', err?.response?.data?.message ?? 'Грешка при отговор.');
                    cancelDialogShownRef.current = false;
                  }
                },
              },
            ],
            { cancelable: false },
          );
        }
        // If the request was cleared (driver's request changed), re-arm
        if (!o.cancel_requested_at) {
          cancelDialogShownRef.current = false;
        }

        if (o.status === 'COMPLETED') {
          clearInterval(intervalId);
          Alert.alert('✅ Курсът приключи', 'Плащането е освободено. Благодарим!',
            [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }]);
        }
        if (o.status === 'CANCELED') {
          clearInterval(intervalId);
          Alert.alert('Поръчката е анулирана', '',
            [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }]);
        }
      } catch { /* silent */ }
    };

    fetchOrder();
    const intervalId = setInterval(fetchOrder, 3_000);
    return () => { mountedRef.current = false; clearInterval(intervalId); };
  }, [params.orderId]);

  // WebSocket — driver GPS position
  const { connected, joinOrder, leaveOrder } = useWebSocket({
    token: accessToken,
    onDriverLocation: useCallback((data) => {
      setDriverPos({ lat: data.lat, lng: data.lng });
      mapRef.current?.panTo(data.lat, data.lng);
    }, []),
    onOrderArrived: useCallback((data) => {
      if (data.orderId === params.orderId) {
        setGeofenceHit(true);
        Alert.alert('🏁 Пристигнахте!', 'Потвърдете завършването.');
      }
    }, [params.orderId]),
    // Driver arrived at pickup — passenger may be inside a building
    onDriverAtPickup: useCallback((data) => {
      if (data.orderId === params.orderId) {
        Alert.alert(
          '🚗 Шофьорът пристигна!',
          'Вашият шофьор чака пред сградата. Моля, излезте.',
          [{ text: 'OK' }],
        );
      }
    }, [params.orderId]),
  });

  useEffect(() => {
    joinOrder(params.orderId);
    return () => leaveOrder(params.orderId);
  }, [params.orderId]);

  // Complete ride — reveal preimage
  const handleComplete = async () => {
    const preimage = pendingInvoice?.preimage ?? restoredPreimage;
    if (!preimage) return; // guard — the button should not be shown without a preimage

    setCompleting(true);
    try {
      const completed = await ordersApi.complete(params.orderId, { preimage });
      setCurrentOrder(completed);
      await clearPreimage(params.orderId);
      Alert.alert('✅ Курсът приключи', 'Плащането е освободено към шофьора. Благодарим!',
        [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }]);
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Не може да се завърши.');
    } finally {
      setCompleting(false);
    }
  };

  // Cancel a stuck order (no preimage available)
  const handleCancelStuck = () => {
    Alert.alert(
      'Анулиране на поръчката',
      'Данните за плащане (preimage) липсват — не може да се завърши нормално. '
      + 'Lightning средствата ще се върнат автоматично при изтичане на invoice-а.\n\n'
      + 'Анулирай поръчката?',
      [
        { text: 'Не', style: 'cancel' },
        {
          text: 'Да, анулирай',
          style: 'destructive',
          onPress: async () => {
            try {
              await ordersApi.cancelByPassenger(params.orderId);
              clearOrder();
              navigation.navigate('Tabs');
            } catch (e: any) {
              Alert.alert('Грешка', e?.response?.data?.message ?? 'Не може да се анулира.');
            }
          },
        },
      ],
    );
  };

  const orderStatus  = currentOrder?.status ?? 'ACCEPTED';
  const isInProgress = orderStatus === 'IN_PROGRESS';
  const hasPreimage  = !!(pendingInvoice?.preimage ?? restoredPreimage);

  const statusLabels: Record<string, string> = {
    HELD:        'Чакаме шофьор...',
    ACCEPTED:    '🚗 Шофьорът идва за вас',
    IN_PROGRESS: '🛣 Курсът е в ход',
    COMPLETED:   '✅ Завършен',
    CANCELED:    '❌ Анулиран',
  };

  // Map centre: midpoint of route if known, otherwise follow driver/fallback
  const center = currentOrder?.pickup_lat && currentOrder?.dropoff_lat
    ? {
        lat: (Number(currentOrder.pickup_lat) + Number(currentOrder.dropoff_lat)) / 2,
        lng: (Number(currentOrder.pickup_lng) + Number(currentOrder.dropoff_lng)) / 2,
      }
    : driverPos ?? (currentOrder
        ? { lat: Number(currentOrder.pickup_lat), lng: Number(currentOrder.pickup_lng) }
        : SOFIA);

  const markers: OsmMarker[] = [];
  // Passenger's own position
  if (myLocation) {
    markers.push({ lat: myLocation.lat, lng: myLocation.lng, label: 'Вие', color: '#2196F3' });
  }
  // Driver's position (from WebSocket)
  if (driverPos) {
    markers.push({ lat: driverPos.lat, lng: driverPos.lng, label: 'Шофьор', color: '#1a1a2e' });
  }
  // Pickup point (start of route — green)
  if (currentOrder?.pickup_lat) {
    markers.push({
      lat:   Number(currentOrder.pickup_lat),
      lng:   Number(currentOrder.pickup_lng),
      label: 'Начало',
      color: '#4caf50',
    });
  }
  // Dropoff destination (end of route — orange)
  if (currentOrder?.dropoff_lat) {
    markers.push({
      lat:   Number(currentOrder.dropoff_lat),
      lng:   Number(currentOrder.dropoff_lng),
      label: 'Дестинация',
      color: '#F7931A',
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusLabel}>{statusLabels[orderStatus] ?? orderStatus}</Text>
        <View style={[styles.dot, connected ? styles.dotGreen : styles.dotRed]} />
      </View>

      {/* OSM map */}
      <OsmMap
        ref={mapRef}
        center={center}
        zoom={14}
        markers={markers}
        locatePosition={myLocation}
        style={styles.map}
      />

      {/* Bottom panel */}
      <View style={styles.panel}>
        <Text style={styles.address} numberOfLines={1}>
          🏁 {currentOrder?.dropoff_address ?? '—'}
        </Text>
        <Text style={styles.price}>
          {currentOrder ? `${parseFloat(currentOrder.price_eur).toFixed(2)} EUR` : '—'}
        </Text>

        {/* Waiting for SecureStore to load */}
        {isInProgress && preimageLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#F7931A" size="small" />
            <Text style={styles.loadingText}>  Зареждане...</Text>
          </View>
        )}

        {/* Normal completion — preimage available */}
        {isInProgress && !preimageLoading && hasPreimage && !completing && (
          <TouchableOpacity
            style={[styles.completeBtn, geofenceHit && styles.completeBtnPulse]}
            onPress={handleComplete}
          >
            <Text style={styles.completeBtnText}>🏁 Потвърди пристигането</Text>
          </TouchableOpacity>
        )}

        {/* Completion in progress */}
        {completing && (
          <View style={styles.completingRow}>
            <ActivityIndicator color="#F7931A" />
            <Text style={styles.completingText}>  Освобождаване на плащането...</Text>
          </View>
        )}

        {/* No preimage — order started in another session or device */}
        {isInProgress && !preimageLoading && !hasPreimage && !completing && (
          <View style={styles.noPreimageBox}>
            <Text style={styles.noPreimageTitle}>⚠️ Липсват данни за плащане</Text>
            <Text style={styles.noPreimageText}>
              Тази поръчка е стартирана в друга сесия. Не може да се завърши нормално —
              Lightning средствата ще се върнат автоматично при изтичане на invoice-а.
            </Text>
            <TouchableOpacity style={styles.cancelStuckBtn} onPress={handleCancelStuck}>
              <Text style={styles.cancelStuckText}>Анулирай поръчката</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Driver is still on the way */}
        {!isInProgress && !preimageLoading && (
          <Text style={styles.hint}>
            {orderStatus === 'ACCEPTED'
              ? 'Шофьорът се придвижва към вас.'
              : 'Освобождаването на плащането ще се задейства при пристигане.'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, backgroundColor: '#1a1a2e',
  },
  dot:      { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  dotGreen: { backgroundColor: '#4caf50' },
  dotRed:   { backgroundColor: '#ef5350' },
  statusLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },

  map: { flex: 1 },

  panel: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  address: { fontSize: 14, color: '#666', marginBottom: 4 },
  price:   { fontSize: 22, fontWeight: 'bold', color: '#F7931A', marginBottom: 12 },

  loadingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 },
  loadingText: { color: '#999', fontSize: 14 },

  completeBtn: {
    backgroundColor: '#4caf50', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  completeBtnPulse: { backgroundColor: '#2e7d32' },
  completeBtnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  completingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 },
  completingText: { color: '#666', fontSize: 14 },

  noPreimageBox: {
    backgroundColor: '#fff8e1', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#ffe082',
  },
  noPreimageTitle: { fontSize: 15, fontWeight: '700', color: '#f57c00', marginBottom: 8 },
  noPreimageText:  { fontSize: 13, color: '#795548', lineHeight: 20, marginBottom: 12 },
  cancelStuckBtn:  { alignItems: 'center', padding: 10 },
  cancelStuckText: { color: '#d32f2f', fontWeight: '600', fontSize: 14 },

  hint: { textAlign: 'center', color: '#999', fontSize: 12, lineHeight: 18 },
});
