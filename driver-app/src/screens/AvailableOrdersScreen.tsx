/**
 * AvailableOrdersScreen — Available orders to accept (status HELD).
 *
 * Refreshes every 5 seconds while the driver is AVAILABLE.
 * Tap -> OrderDetailScreen for details and acceptance.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ordersApi }     from '@crypgo/shared';
import { useDriverStore } from '@/store/useDriverStore';
import type { Order }     from '@crypgo/shared';
import type { AppNavProp } from '@/navigation/types';

export default function AvailableOrdersScreen() {
  const navigation = useNavigation<AppNavProp>();
  const status     = useDriverStore((s) => s.status);

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (status !== 'AVAILABLE') { setOrders([]); return; }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await ordersApi.available();
      setOrders(data);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [status]);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 5_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  if (status !== 'AVAILABLE') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.offlineText}>
          Превключете на ОНЛАЙН от Карта за да виждате поръчки.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Налични поръчки</Text>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#1a1a2e" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Няма налични поръчки в момента.</Text>
          }
          renderItem={({ item: order }) => {
            const km   = (order.distance_meters / 1000).toFixed(1);
            const mins = Math.round(order.duration_seconds / 60);
            const eur  = parseFloat(order.price_eur).toFixed(2);

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.price}>💰 {eur} EUR</Text>
                  <Text style={styles.meta}>{km} км · ~{mins} мин</Text>
                </View>
                <Text style={styles.addr} numberOfLines={1}>📍 {order.pickup_address}</Text>
                <Text style={styles.addr} numberOfLines={1}>🏁 {order.dropoff_address}</Text>
                <Text style={styles.acceptHint}>Натиснете за детайли →</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const NAVY = '#1a1a2e';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  offlineText: { textAlign: 'center', color: '#999', fontSize: 16, lineHeight: 24 },
  title:     { fontSize: 20, fontWeight: 'bold', color: '#333', padding: 16 },
  empty:     { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
  card: {
    margin: 12, borderRadius: 16, backgroundColor: '#f8f9ff',
    padding: 16, borderWidth: 1, borderColor: '#e0e4ff',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  price:      { fontSize: 18, fontWeight: 'bold', color: NAVY },
  meta:       { fontSize: 14, color: '#666' },
  addr:       { fontSize: 14, color: '#555', marginBottom: 4 },
  acceptHint: { fontSize: 12, color: NAVY, textAlign: 'right', marginTop: 6 },
});
