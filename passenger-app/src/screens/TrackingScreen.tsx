/**
 * TrackingScreen — Real-time проследяване на шофьора.
 *
 * Polling на статуса на поръчката на всеки 3с.
 * WebSocket за GPS позицията на шофьора и geofencing trigger.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { SafeAreaView as SafeArea } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ordersApi, OsmMap } from '@cryptgo/shared';
import type { OsmMapRef, OsmMarker } from '@cryptgo/shared';
import { useWebSocket } from '@cryptgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { useOrderStore } from '@/store/useOrderStore';
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

  const mapRef       = useRef<OsmMapRef>(null);
  const mountedRef   = useRef(true);

  const [driverPos,   setDriverPos]   = useState<{ lat: number; lng: number } | null>(null);
  const [completing,  setCompleting]  = useState(false);
  const [geofenceHit, setGeofenceHit] = useState(false);

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
          Alert.alert('✅ Курсът приключи', 'Плащането е освободено. Благодарим!',
            [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }]);
        }
        if (o.status === 'CANCELED') {
          clearInterval(intervalId);
          Alert.alert('Поръчката е анулирана', '',
            [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }]);
        }
      } catch { /* тихо */ }
    };

    fetchOrder();
    const intervalId = setInterval(fetchOrder, 3_000);
    return () => { mountedRef.current = false; clearInterval(intervalId); };
  }, [params.orderId]);

  // ── WebSocket — GPS позиция на шофьора ────────────────────────────
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
  });

  useEffect(() => {
    joinOrder(params.orderId);
    return () => leaveOrder(params.orderId);
  }, [params.orderId]);

  // ── Завършване — разкриване на preimage ──────────────────────────
  const handleComplete = async () => {
    if (!pendingInvoice?.preimage) {
      Alert.alert('Грешка', 'Preimage не е наличен.');
      return;
    }
    setCompleting(true);
    try {
      // СИГУРНОСТ: preimage се изпраща САМО при завършване
      const completed = await ordersApi.complete(params.orderId, {
        preimage: pendingInvoice.preimage,
      });
      setCurrentOrder(completed);
      Alert.alert('✅ Курсът приключи', 'Плащането е освободено към шофьора. Благодарим!',
        [{ text: 'OK', onPress: () => { clearOrder(); navigation.navigate('Tabs'); } }]);
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Не може да се завърши.');
    } finally {
      setCompleting(false);
    }
  };

  const orderStatus  = currentOrder?.status ?? 'ACCEPTED';
  const isInProgress = orderStatus === 'IN_PROGRESS';

  const statusLabels: Record<string, string> = {
    HELD:        'Чакаме шофьор...',
    ACCEPTED:    '🚗 Шофьорът идва за вас',
    IN_PROGRESS: '🛣 Курсът е в ход',
    COMPLETED:   '✅ Завършен',
    CANCELED:    '❌ Анулиран',
  };

  // Маркери за картата
  const center = driverPos ?? (currentOrder
    ? { lat: Number(currentOrder.pickup_lat), lng: Number(currentOrder.pickup_lng) }
    : SOFIA);

  const markers: OsmMarker[] = [];
  if (driverPos) {
    markers.push({ lat: driverPos.lat, lng: driverPos.lng, label: '🚕 Шофьор', color: '#1a1a2e' });
  }
  if (currentOrder?.dropoff_lat) {
    markers.push({
      lat: Number(currentOrder.dropoff_lat),
      lng: Number(currentOrder.dropoff_lng),
      label: '🏁 Дестинация',
      color: '#F7931A',
    });
  }

  return (
    <SafeArea style={styles.container}>
      {/* Status bar */}
      <View style={[styles.statusBar, isInProgress && styles.statusBarActive]}>
        <View style={[styles.dot, connected ? styles.dotGreen : styles.dotRed]} />
        <Text style={styles.statusLabel}>{statusLabels[orderStatus] ?? orderStatus}</Text>
      </View>

      {/* OSM карта */}
      <OsmMap
        ref={mapRef}
        center={center}
        zoom={14}
        markers={markers}
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

        {!isInProgress && (
          <Text style={styles.hint}>
            {orderStatus === 'ACCEPTED'
              ? 'Шофьорът се придвижва към вас.'
              : 'Освобождаването на плащането ще се задейства при пристигане.'}
          </Text>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
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
  completeBtnPulse: { backgroundColor: '#2e7d32' },
  completeBtnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  completingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 },
  completingText: { color: '#666', fontSize: 14 },

  hint: { textAlign: 'center', color: '#999', fontSize: 12, lineHeight: 18 },
});
