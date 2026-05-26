/**
 * OrderDetailScreen — Детайли за поръчка + бутон "Приеми".
 *
 * Показва:
 *   - Карта с pickup и dropoff точки
 *   - Маршрут (разстояние, ETA, цена)
 *   - Бутон "Приеми поръчката" → HELD → ACCEPTED
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ordersApi } from '@cryptgo/shared';
import { useDriverStore } from '@/store/useDriverStore';
import { setActiveOrderId } from '@/services/backgroundLocation.service';
import type { Order }        from '@cryptgo/shared';
import type { AppStackParamList, AppNavProp } from '@/navigation/types';

type Route = RouteProp<AppStackParamList, 'OrderDetail'>;

export default function OrderDetailScreen() {
  const navigation     = useNavigation<AppNavProp>();
  const { params }     = useRoute<Route>();
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
      setActiveOrderId(accepted.id);     // background location ще broadcast-ва orderId
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
          <Text style={styles.backLink}>← Обратно към поръчките</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pickup  = { latitude: Number(order.pickup_lat),  longitude: Number(order.pickup_lng) };
  const dropoff = { latitude: Number(order.dropoff_lat), longitude: Number(order.dropoff_lng) };
  const km   = (order.distance_meters / 1000).toFixed(1);
  const mins = Math.round(order.duration_seconds / 60);
  const eur  = parseFloat(order.price_eur).toFixed(2);

  // Центрираме картата между pickup и dropoff
  const midLat  = (pickup.latitude + dropoff.latitude) / 2;
  const midLng  = (pickup.longitude + dropoff.longitude) / 2;
  const delta   = Math.max(Math.abs(pickup.latitude - dropoff.latitude) * 1.5, 0.02);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Map */}
        <MapView
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: delta, longitudeDelta: delta }}
        >
          <Marker coordinate={pickup}  title="Вземане" pinColor="#4caf50" />
          <Marker coordinate={dropoff} title="Дестинация" pinColor="#f44336" />
        </MapView>

        {/* Details */}
        <View style={styles.details}>
          <Text style={styles.sectionTitle}>Маршрут</Text>
          <Row label="📍 Вземане"      value={order.pickup_address} />
          <Row label="🏁 Дестинация"   value={order.dropoff_address} />
          <View style={styles.divider} />
          <Row label="Разстояние"      value={`${km} км`} />
          <Row label="Прибл. времетраене" value={`~${mins} мин`} />
          <View style={styles.divider} />
          <Row label="💰 Приход"       value={`${eur} EUR`} bold />
        </View>
      </ScrollView>

      {/* Accept button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} disabled={accepting}>
          {accepting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.acceptText}>✅ Приеми поръчката</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>← Обратно</Text>
        </TouchableOpacity>
      </View>
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
  map:          { height: 220 },
  details:      { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  divider:      { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fff',
  },
  acceptBtn: { backgroundColor: '#4caf50', borderRadius: 14, padding: 16, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn:  { alignItems: 'center', marginTop: 10 },
  cancelText: { color: '#999', fontSize: 14 },
});
