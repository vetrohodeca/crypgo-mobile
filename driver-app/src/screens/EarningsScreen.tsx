import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ordersApi } from '@cryptgo/shared';
import type { Order } from '@cryptgo/shared';
import type { AppNavProp } from '@/navigation/types';

const ACTIVE_STATUSES  = new Set(['ACCEPTED', 'IN_PROGRESS']);
const HISTORY_STATUSES = new Set(['COMPLETED', 'CANCELED']);

export default function EarningsScreen() {
  const navigation = useNavigation<AppNavProp>();

  const [orders,     setOrders]     = useState<Order[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await ordersApi.driverOrders();
      setOrders(data);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, []);

  const completed = orders.filter((o) => o.status === 'COMPLETED');
  const totalEur  = completed.reduce((sum, o) => sum + parseFloat(o.price_eur), 0);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#1a1a2e" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Общо приходи</Text>
        <Text style={styles.summaryAmount}>{totalEur.toFixed(2)} EUR</Text>
        <Text style={styles.summaryCount}>{completed.length} завършени курса</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} />}
        ListEmptyComponent={<Text style={styles.empty}>Нямате курсове още.</Text>}
        renderItem={({ item: order }) => {
          const STATUS: Record<string, string> = {
            COMPLETED:   '✅ Завършен',
            CANCELED:    '❌ Анулиран',
            ACCEPTED:    '🚕 Приет',
            IN_PROGRESS: '🚗 В ход',
            HELD:        '🔒 Чака',
            CREATED:     '⏳',
          };
          const COLOR: Record<string, string> = {
            COMPLETED:   '#4caf50',
            CANCELED:    '#f44336',
            ACCEPTED:    '#9c27b0',
            IN_PROGRESS: '#2196f3',
            HELD:        '#ff9800',
            CREATED:     '#999',
          };

          const isActive  = ACTIVE_STATUSES.has(order.status);
          const isHistory = HISTORY_STATUSES.has(order.status);
          const isTappable = isActive || isHistory;

          return (
            <TouchableOpacity
              style={[
                styles.card,
                isActive  && styles.cardActive,
                isHistory && styles.cardHistory,
              ]}
              activeOpacity={isTappable ? 0.7 : 1}
              onPress={() => {
                if (isActive) {
                  navigation.navigate('ActiveRide', { orderId: order.id });
                } else if (isHistory) {
                  navigation.navigate('OrderDetail', { orderId: order.id, readOnly: true });
                }
              }}
            >
              <View style={styles.cardRow}>
                <Text style={styles.date}>
                  {new Date(order.created_at).toLocaleDateString('bg-BG')}
                </Text>
                <Text style={[styles.status, { color: COLOR[order.status] ?? '#333' }]}>
                  {STATUS[order.status] ?? order.status}
                </Text>
              </View>
              <Text style={styles.addr} numberOfLines={1}>📍 {order.pickup_address}</Text>
              <Text style={styles.addr} numberOfLines={1}>🏁 {order.dropoff_address}</Text>
              <View style={styles.cardRow}>
                <Text style={styles.km}>{(order.distance_meters / 1000).toFixed(1)} км</Text>
                {order.status === 'COMPLETED' && (
                  <Text style={styles.earn}>+{parseFloat(order.price_eur).toFixed(2)} EUR</Text>
                )}
                {isActive && (
                  <Text style={styles.tapHint}>Натисни за да продължиш →</Text>
                )}
                {isHistory && (
                  <Text style={styles.tapHintHistory}>Виж на карта →</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const NAVY = '#1a1a2e';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: {
    backgroundColor: NAVY, padding: 24, alignItems: 'center',
  },
  summaryLabel:  { color: '#aaa', fontSize: 14, marginBottom: 4 },
  summaryAmount: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  summaryCount:  { color: '#aaa', fontSize: 13, marginTop: 4 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 },

  card: {
    margin: 12, borderRadius: 14, backgroundColor: '#fafafa',
    padding: 14, borderWidth: 1, borderColor: '#f0f0f0',
  },
  cardActive: {
    borderColor: '#2196f3', backgroundColor: '#f0f7ff', borderWidth: 1.5,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  date:    { fontSize: 13, color: '#999' },
  status:  { fontSize: 13, fontWeight: '600' },
  addr:    { fontSize: 14, color: '#555', marginBottom: 4 },
  km:      { fontSize: 13, color: '#888' },
  earn:    { fontSize: 15, fontWeight: 'bold', color: '#4caf50' },
  tapHint:        { fontSize: 12, color: '#2196f3', fontStyle: 'italic' },
  tapHintHistory: { fontSize: 12, color: '#888',   fontStyle: 'italic' },
  cardHistory: {
    borderColor: '#e0e0e0',
  },
});
