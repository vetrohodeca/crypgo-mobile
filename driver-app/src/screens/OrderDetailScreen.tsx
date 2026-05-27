/**
 * OrderDetailScreen — Order details.
 *
 * Two modes:
 *   readOnly=false (default) — before acceptance, shows "Accept" button
 *   readOnly=true  — ride history, map + info only, no action buttons
 *
 * Displays:
 *   - Map with pickup and dropoff points
 *   - Route (distance, ETA, price)
 *   - Order status (in readOnly mode)
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ordersApi, OsmMap } from '@cryptgo/shared';
import { useDriverStore } from '@/store/useDriverStore';
import { setActiveOrderId } from '@/services/backgroundLocation.service';
import type { Order, OrderStatus } from '@cryptgo/shared';
import type { AppStackParamList, AppNavProp } from '@/navigation/types';

type Route = RouteProp<AppStackParamList, 'OrderDetail'>;

const STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED:     '⏳ Създадена',
  HELD:        '🔒 Платена — чака шофьор',
  ACCEPTED:    '🚕 Приета',
  IN_PROGRESS: '🚗 В ход',
  COMPLETED:   '✅ Завършена',
  CANCELED:    '❌ Анулирана',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  CREATED:     '#999',
  HELD:        '#ff9800',
  ACCEPTED:    '#9c27b0',
  IN_PROGRESS: '#2196f3',
  COMPLETED:   '#4caf50',
  CANCELED:    '#f44336',
};

export default function OrderDetailScreen() {
  const navigation     = useNavigation<AppNavProp>();
  const { params }     = useRoute<Route>();
  const readOnly       = params.readOnly ?? false;
  const setActiveOrder = useDriverStore((s) => s.setActiveOrder);
  const setStatus      = useDriverStore((s) => s.setStatus);

  const [order,    setOrder]    = useState<Order | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    ordersApi.findOne(params.orderId)
      .then(setOrder)
      .catch((err: any) => {
        const msg = err?.response?.data?.message ?? 'Поръчката не е намерена или е вече приета.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [params.orderId]);

  const handleAccept = async () => {
    if (!order) return;
    setAccepting(true);
    try {
      const accepted = await ordersApi.accept(order.id);
      setActiveOrder(accepted);
      setActiveOrderId(accepted.id);     // background location will broadcast orderId
      await setStatus('BUSY');
      navigation.replace('ActiveRide', { orderId: accepted.id });
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Не може да приемете поръчката.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a1a2e" /></View>;
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'Поръчката не е намерена.'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={styles.backLink}>← Обратно</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pickup  = { latitude: Number(order.pickup_lat),  longitude: Number(order.pickup_lng) };
  const dropoff = { latitude: Number(order.dropoff_lat), longitude: Number(order.dropoff_lng) };
  const km   = (order.distance_meters / 1000).toFixed(1);
  const mins = Math.round(order.duration_seconds / 60);
  const eur  = parseFloat(order.price_eur).toFixed(2);

  // Centre the map between pickup and dropoff
  const midLat = (pickup.latitude + dropoff.latitude) / 2;
  const midLng = (pickup.longitude + dropoff.longitude) / 2;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Обратно</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {readOnly ? 'Детайли на курс' : 'Нова поръчка'}
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView>
        {/* OSM map */}
        <OsmMap
          center={{ lat: midLat, lng: midLng }}
          zoom={13}
          markers={[
            { lat: pickup.latitude,  lng: pickup.longitude,  label: '📍 Вземане',    color: '#4caf50' },
            { lat: dropoff.latitude, lng: dropoff.longitude, label: '🏁 Дестинация', color: '#f44336' },
          ]}
          style={styles.map}
        />

        {/* Status (readOnly mode only) */}
        {readOnly && (
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[order.status] + '18' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] }]}>
              {STATUS_LABEL[order.status]}
            </Text>
            <Text style={styles.statusDate}>
              {new Date(order.created_at).toLocaleString('bg-BG')}
            </Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.details}>
          <Text style={styles.sectionTitle}>Маршрут</Text>
          <Row label="📍 Вземане"         value={order.pickup_address} />
          <Row label="🏁 Дестинация"      value={order.dropoff_address} />
          <View style={styles.divider} />
          <Row label="Разстояние"          value={`${km} км`} />
          <Row label="Прибл. времетраене" value={`~${mins} мин`} />
          <View style={styles.divider} />
          <Row
            label={order.status === 'COMPLETED' ? '💰 Приход' : '💰 Цена'}
            value={`${eur} EUR`}
            bold
          />
        </View>
      </ScrollView>

      {/* Footer — active mode only */}
      {!readOnly && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} disabled={accepting}>
            {accepting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.acceptText}>✅ Приеми поръчката</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>← Откажи</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 }}>
      <Text style={{ color: '#666', fontSize: 14, flex: 1 }}>{label}</Text>
      <Text style={{ color: '#333', fontSize: 14, fontWeight: bold ? 'bold' : 'normal', flex: 1, textAlign: 'right' }}
            numberOfLines={2}>{value}</Text>
    </View>
  );
}

const NAVY = '#1a1a2e';
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText:    { color: '#e74c3c', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  backLink:     { color: NAVY, fontSize: 15, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#fff',
  },
  backBtn:      { width: 80 },
  backBtnText:  { color: NAVY, fontSize: 15, fontWeight: '600' },
  headerTitle:  { fontSize: 16, fontWeight: 'bold', color: '#333' },

  // Map
  map: { height: 260 },

  // Status badge (readOnly)
  statusBadge: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  statusText: { fontSize: 16, fontWeight: '700' },
  statusDate: { fontSize: 12, color: '#999', marginTop: 4 },

  // Details
  details:      { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  divider:      { height: 1, backgroundColor: '#eee', marginVertical: 10 },

  // Footer styles
  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff',
  },
  acceptBtn:  { backgroundColor: '#4caf50', borderRadius: 14, padding: 16, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn:  { alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#999', fontSize: 14 },
});
