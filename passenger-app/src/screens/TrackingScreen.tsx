/**
 * TrackingScreen — Real-time проследяване на шофьора.
 *
 * Polling на статуса на поръчката на всеки 3с.
 * WebSocket за GPS позицията на шофьора и geofencing trigger (order:arrived).
 *
 * Фази:
 *   ACCEPTED    → шофьорът идва за пътника, бутонът не се показва
 *   IN_PROGRESS → курсът е в ход, бутонът "Потвърди пристигане" е видим
 *   COMPLETED   → плащането е освободено, навигация към начало
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ordersApi } from '@cryptgo/shared';
import { useWebSocket } from '@cryptgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { useOrderStore } from '@/store/useOrderStore';
import type { AppStackParamList, AppNavProp } from '@/navigation/types';

type Route = RouteProp<AppStackParamList, 'Tracking'>;

interface DriverPosition { lat: number; lng: number; }

export default function TrackingScreen() {
  const navigation      = useNavigation<AppNavProp>();
  const { params }      = useRoute<Route>();
  const accessToken     = useAuthStore((s) => s.accessToken);
  const currentOrder    = useOrderStore((s) => s.currentOrder);
  const pendingInvoice  = useOrderStore((s) => s.pendingInvoice);
  const setCurrentOrder = useOrderStore((s) => s.setCurrentOrder);
  const clearOrder      = useOrderStore((s) => s.clear);

  const [driverPos,   setDriverPos]   = useState<DriverPosition | null>(null);
  const [completing,  setCompleting]  = useState(false);
  const [geofenceHit, setGeofenceHit] = useState(false); // WebSocket geofencing trigger
  const mapRef       = useRef<MapView>(null);
  const mountedRef   = useRef(true);

  // ── Polling — статус на поръчката (всеки 3с) ─────────────────────
  useEffect(() => {
    mountedRef.current = true;

    const fetchOrder = async () => {
      try {
        const o = await ordersApi.findOne(params.orderId);
        if (!mountedRef.current) return;
        setCurrentOrder(o);

        if (o.status === 'COMPLETED') {
          clearInterval(intervalId);
          Alert.alert(
            '✅ Курсът приключи',
            'Плащането е освободено към шофьора. Благодарим!',
            [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }],
          );
        }
        if (o.status === 'CANCELED') {
          clearInterval(intervalId);
          Alert.alert('Поръчката е анулирана', '', [
            { text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } },
          ]);
        }
      } catch { /* тихо — не прекъсваме polling при временна мрежова грешка */ }
    };

    fetchOrder();
    const intervalId = setInterval(fetchOrder, 3_000);
    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [params.orderId]);

  // ── WebSocket — GPS позиция на шофьора + geofencing ──────────────
  const { connected, joinOrder, leaveOrder } = useWebSocket({
    token: accessToken,
    onDriverLocation: useCallback((data) => {
      setDriverPos({ lat: data.lat, lng: data.lng });
      mapRef.current?.animateToRegion({
        latitude: data.lat, longitude: data.lng,
        latitudeDelta: 0.01, longitudeDelta: 0.01,
      }, 500);
    }, []),
    onOrderArrived: useCallback((data) => {
      if (data.orderId === params.orderId) {
        setGeofenceHit(true); // бутонът вече е видим при IN_PROGRESS — само подчертаваме
        Alert.alert('🏁 Пристигнахте!', 'Шофьорът е на дестинацията. Потвърдете завършването.');
      }
    }, [params.orderId]),
  });

  useEffect(() => {
    joinOrder(params.orderId);
    return () => leaveOrder(params.orderId);
  }, [params.orderId]);

  // ── Завършване — разкриване на preimage ──────────────────────────
  const handleComplete = async () => {
    if (!pendingInvoice?.preimage) {
      Alert.alert('Грешка', 'Preimage не е наличен. Рестартирайте приложението.');
      return;
    }
    setCompleting(true);
    try {
      // СИГУРНОСТ: preimage-ът се изпраща САМО при завършване на курса
      const completed = await ordersApi.complete(params.orderId, {
        preimage: pendingInvoice.preimage,
      });
      setCurrentOrder(completed);
      Alert.alert(
        '✅ Курсът приключи',
        'Плащането е освободено към шофьора. Благодарим!',
        [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }],
      );
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Не може да се завърши.');
    } finally {
      setCompleting(false);
    }
  };

  const orderStatus = currentOrder?.status ?? 'ACCEPTED';
  const isInProgress = orderStatus === 'IN_PROGRESS';

  const statusLabels: Record<string, string> = {
    HELD:        'Чакаме шофьор...',
    ACCEPTED:    '🚗 Шофьорът идва за вас',
    IN_PROGRESS: '🛣 Курсът е в ход',
    COMPLETED:   '✅ Завършен',
    CANCELED:    '❌ Анулиран',
  };

  const dropoff = currentOrder
    ? { latitude: Number(currentOrder.dropoff_lat), longitude: Number(currentOrder.dropoff_lng) }
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <View style={[styles.statusBar, isInProgress && styles.statusBarActive]}>
        <View style={[styles.dot, connected ? styles.dotGreen : styles.dotRed]} />
        <Text style={styles.statusLabel}>{statusLabels[orderStatus] ?? orderStatus}</Text>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude:       driverPos?.lat ?? 42.6977,
          longitude:      driverPos?.lng ?? 23.3219,
          latitudeDelta:  0.02,
          longitudeDelta: 0.02,
        }}
      >
        {driverPos && (
          <Marker coordinate={{ latitude: driverPos.lat, longitude: driverPos.lng }} title="Шофьор">
            <Text style={{ fontSize: 26 }}>🚕</Text>
          </Marker>
        )}
        {dropoff && (
          <Marker coordinate={dropoff} title="Дестинация" pinColor="#F7931A" />
        )}
      </MapView>

      {/* Bottom panel */}
      <View style={styles.panel}>
        <Text style={styles.address} numberOfLines={1}>
          🏁 {currentOrder?.dropoff_address ?? '—'}
        </Text>
        <Text style={styles.price}>
          {currentOrder ? `${parseFloat(currentOrder.price_eur).toFixed(2)} EUR` : '—'}
        </Text>

        {/* Бутонът е видим щом шофьорът е стартирал курса (IN_PROGRESS) */}
        {isInProgress && !completing && (
          <TouchableOpacity
            style={[styles.completeBtn, geofenceHit && styles.completeBtnPulse]}
            onPress={handleComplete}
          >
            <Text style={styles.completeBtnText}>🏁 Потвърди пристигането</Text>
          </TouchableOpacity>
        )}

        {completing && (
          <View style={styles.completingRow}>
            <ActivityIndicator color="#F7931A" />
            <Text style={styles.completingText}>  Освобождаване на плащането...</Text>
          </View>
        )}

        {/* Хинт докато шофьорът не е стартирал */}
        {!isInProgress && (
          <Text style={styles.hint}>
            {orderStatus === 'ACCEPTED'
              ? 'Шофьорът се придвижва към вас. Бутонът за потвърждение ще се появи при тръгване.'
              : 'Освобождаването на плащането ще се задейства при пристигане.'}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  statusBarActive: { backgroundColor: '#fff8f0' },
  dot:      { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotGreen: { backgroundColor: '#4caf50' },
  dotRed:   { backgroundColor: '#f44336' },
  statusLabel: { fontSize: 15, fontWeight: '600', color: '#333' },

  map: { flex: 1 },

  panel: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  address: { fontSize: 14, color: '#666', marginBottom: 4 },
  price:   { fontSize: 22, fontWeight: 'bold', color: '#F7931A', marginBottom: 12 },

  completeBtn: {
    backgroundColor: '#4caf50', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  completeBtnPulse: { backgroundColor: '#2e7d32' }, // по-тъмно когато geofencing потвърди
  completeBtnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  completingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 },
  completingText: { color: '#666', fontSize: 14 },

  hint: { textAlign: 'center', color: '#999', fontSize: 12, lineHeight: 18 },
});
