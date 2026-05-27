import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ordersApi } from '@cryptgo/shared';
import type { Order, OrderStatus } from '@cryptgo/shared';
import { useOrderStore } from '@/store/useOrderStore';
import type { AppNavProp } from '@/navigation/types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED:     '⏳ Чака плащане',
  HELD:        '🔒 Escrow активен',
  ACCEPTED:    '🚕 Шофьор идва',
  IN_PROGRESS: '🚗 Курсът е в ход',
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

const ACTIVE_STATUSES = new Set<OrderStatus>(['ACCEPTED', 'IN_PROGRESS']);

export default function OrderHistoryScreen() {
  const navigation      = useNavigation<AppNavProp>();
  const setCurrentOrder = useOrderStore((s) => s.setCurrentOrder);

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
    <SafeAreaView style={styles.container}>
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
        renderItem={({ item: order }) => {
          const isActive = ACTIVE_STATUSES.has(order.status);

          return (
            <TouchableOpacity
              style={[styles.card, isActive && styles.cardActive]}
              activeOpacity={isActive ? 0.7 : 1}
              onPress={() => {
                if (!isActive) return;
                // Sync the store and open TrackingScreen
                setCurrentOrder(order);
                navigation.navigate('Tracking', { orderId: order.id });
              }}
            >
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
                {isActive ? (
                  <Text style={styles.tapHint}>Натисни за да проследиш →</Text>
                ) : (
                  <Text style={styles.price}>
                    {parseFloat(order.price_eur).toFixed(2)} EUR
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
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
  cardActive: {
    borderColor: '#4CAF50', backgroundColor: '#f0fff4', borderWidth: 1.5,
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
  dist:    { fontSize: 14, color: '#888' },
  price:   { fontSize: 16, fontWeight: 'bold', color: '#F7931A' },
  tapHint: { fontSize: 12, color: '#4CAF50', fontStyle: 'italic', fontWeight: '600' },
});
