import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { ordersApi } from '@cryptgo/shared';
import type { Order, OrderStatus } from '@cryptgo/shared';

const STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED:     '⏳ Чака плащане',
  HELD:        '🔒 Escrow активен',
  ACCEPTED:    '🚕 Шофьор приел',
  IN_PROGRESS: '🚗 В ход',
  COMPLETED:   '✅ Завършен',
  CANCELED:    '❌ Анулиран',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  CREATED:     '#FF9800',
  HELD:        '#2196F3',
  ACCEPTED:    '#9C27B0',
  IN_PROGRESS: '#4CAF50',
  COMPLETED:   '#388E3C',
  CANCELED:    '#F44336',
};

export default function OrderHistoryScreen() {
  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await ordersApi.myOrders();
      setOrders(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F7931A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>История на поръчки</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Нямате поръчки още.</Text>
        }
        renderItem={({ item: order }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.date}>
                {new Date(order.created_at).toLocaleDateString('bg-BG')}
              </Text>
              <Text style={[styles.status, { color: STATUS_COLORS[order.status] }]}>
                {STATUS_LABELS[order.status]}
              </Text>
            </View>
            <Text style={styles.address} numberOfLines={1}>📍 {order.pickup_address}</Text>
            <Text style={styles.address} numberOfLines={1}>🏁 {order.dropoff_address}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.dist}>
                {(order.distance_meters / 1000).toFixed(1)} км
              </Text>
              <Text style={styles.price}>
                {parseFloat(order.price_eur).toFixed(2)} EUR
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontSize: 20, fontWeight: 'bold', color: '#333',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },
  card: {
    margin: 12, borderRadius: 14, backgroundColor: '#fafafa',
    padding: 14, borderWidth: 1, borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8,
  },
  date:    { fontSize: 13, color: '#999' },
  status:  { fontSize: 13, fontWeight: '600' },
  address: { fontSize: 14, color: '#555', marginBottom: 4 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
  },
  dist:  { fontSize: 14, color: '#888' },
  price: { fontSize: 16, fontWeight: 'bold', color: '#F7931A' },
});
