/**
 * ActiveRideScreen — Active ride for the driver.
 *
 * Phases:
 *   ACCEPTED    -> map to pickup address, "I picked up the passenger" button (startOrder)
 *   IN_PROGRESS -> map to dropoff, waiting for preimage reveal from the passenger
 *   COMPLETED   -> show payment confirmation
 *
 * GPS stream continues from the background service.
 * Poll order status every 3 seconds.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ordersApi, OsmMap } from '@crypgo/shared';
import * as ExpoLocation from 'expo-location';
import { useDriverStore } from '@/store/useDriverStore';
import { setActiveOrderId, stopBackgroundTracking } from '@/services/backgroundLocation.service';
import type { Order } from '@crypgo/shared';
import type { AppStackParamList, AppNavProp } from '@/navigation/types';

type Route = RouteProp<AppStackParamList, 'ActiveRide'>;

export default function ActiveRideScreen() {
  const navigation     = useNavigation<AppNavProp>();
  const { params }     = useRoute<Route>();
  const setActiveOrder = useDriverStore((s) => s.setActiveOrder);
  const setStatus      = useDriverStore((s) => s.setStatus);
  const [order,       setOrder]      = useState<Order | null>(null);
  const [loading,     setLoading]    = useState(true);
  const [acting,      setActing]     = useState(false);
  const [myLocation,  setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  // GPS — driver's own position (direct expo-location)
  useEffect(() => {
    let sub: ExpoLocation.LocationSubscription | null = null;
    let mounted = true;

    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;

      // Get an immediate fix so the marker appears right away
      try {
        const initial = await ExpoLocation.getCurrentPositionAsync(
          { accuracy: ExpoLocation.Accuracy.Balanced },
        );
        if (mounted) setMyLocation({ lat: initial.coords.latitude, lng: initial.coords.longitude });
      } catch { /* no fix yet — watcher will update when available */ }

      sub = await ExpoLocation.watchPositionAsync(
        { accuracy: ExpoLocation.Accuracy.Balanced, timeInterval: 3_000, distanceInterval: 0 },
        (loc) => { if (mounted) setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }); },
      );
    })();

    return () => { mounted = false; sub?.remove(); };
  }, []);

  // Tracks previous cancel_requested_at so we can detect when the passenger
  // refuses (transition from set -> null while still IN_PROGRESS).
  const prevCancelRequestedRef = useRef<string | null>(null);

  // Poll order status
  useEffect(() => {
    let mounted = true;

    const fetchOrder = async () => {
      try {
        const o = await ordersApi.findOne(params.orderId);
        if (!mounted) return;

        // Detect passenger response to a pending cancel request
        const prev = prevCancelRequestedRef.current;
        const curr = o.cancel_requested_at;
        if (prev && !curr && o.status === 'IN_PROGRESS') {
          Alert.alert(
            'Пътникът отказа',
            'Пътникът не потвърди анулирането. Моля, продължете курса.',
          );
        }
        prevCancelRequestedRef.current = curr;

        setOrder(o);
        setActiveOrder(o);

        if (o.status === 'COMPLETED' || o.status === 'CANCELED') {
          clearInterval(intervalId);
          setActiveOrderId(null);
          stopBackgroundTracking();
          setStatus('AVAILABLE');
          setActiveOrder(null);
        }
      } catch { /* silent */ }
      finally { if (mounted) setLoading(false); }
    };

    fetchOrder();
    const intervalId = setInterval(fetchOrder, 3_000);
    return () => { mounted = false; clearInterval(intervalId); };
  }, [params.orderId]);

  // Pickup passenger: ACCEPTED -> IN_PROGRESS
  const handlePickup = async () => {
    if (!order) return;
    setActing(true);
    try {
      const updated = await ordersApi.start(order.id);
      setOrder(updated);
      setActiveOrder(updated);
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Грешка при стартиране.');
    } finally {
      setActing(false);
    }
  };

  // Cancel by driver — direct (ACCEPTED, before pickup)
  const handleCancel = () => {
    Alert.alert('Анулиране', 'Сигурни ли сте?', [
      { text: 'Не', style: 'cancel' },
      {
        text: 'Да, анулирай',
        style: 'destructive',
        onPress: async () => {
          try {
            await ordersApi.cancelByDriver(params.orderId);
            setActiveOrderId(null);
            setActiveOrder(null);
            await setStatus('AVAILABLE');
            navigation.navigate('Tabs');
          } catch (e: any) {
            Alert.alert('Грешка', e?.response?.data?.message ?? 'Не може да се анулира.');
          }
        },
      },
    ]);
  };

  // Request cancel during IN_PROGRESS — passenger must approve
  const handleRequestCancel = () => {
    Alert.alert(
      'Заявка за анулиране',
      'Пътникът трябва да потвърди анулирането. Сигурни ли сте?',
      [
        { text: 'Не', style: 'cancel' },
        {
          text: 'Да, заявявам',
          style: 'destructive',
          onPress: async () => {
            try {
              await ordersApi.requestCancel(params.orderId);
              Alert.alert(
                'Заявката е изпратена',
                'Чакаме пътникът да потвърди. Ще ви известим когато отговори.',
              );
            } catch (e: any) {
              Alert.alert('Грешка', e?.response?.data?.message ?? 'Грешка при заявката.');
            }
          },
        },
      ],
    );
  };

  if (loading || !order) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a1a2e" /></View>;
  }

  const isPickup  = order.status === 'ACCEPTED';
  const targetAddr = isPickup ? order.pickup_address : order.dropoff_address;

  // Fixed route endpoints — always shown on map
  const pickupPoint  = { lat: Number(order.pickup_lat),  lng: Number(order.pickup_lng) };
  const dropoffPoint = { lat: Number(order.dropoff_lat), lng: Number(order.dropoff_lng) };

  // Map centre: midpoint of the full route (stable — doesn't jump as driver moves)
  const routeCenter = {
    lat: (pickupPoint.lat  + dropoffPoint.lat)  / 2,
    lng: (pickupPoint.lng + dropoffPoint.lng) / 2,
  };

  const isCompleted = order.status === 'COMPLETED';
  const isCanceled  = order.status === 'CANCELED';

  if (isCompleted) {
    return (
      <SafeAreaView style={styles.doneContainer}>
        <Text style={styles.doneIcon}>✅</Text>
        <Text style={styles.doneTitle}>Курсът приключи!</Text>
        <Text style={styles.doneSub}>
          Плащането е освободено.{'\n'}
          {parseFloat(order.price_eur).toFixed(2)} EUR → вашия Lightning портфейл.
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Tabs')}>
          <Text style={styles.doneBtnText}>Към начало</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isCanceled) {
    return (
      <SafeAreaView style={styles.doneContainer}>
        <Text style={styles.doneIcon}>❌</Text>
        <Text style={styles.doneTitle}>Поръчката е анулирана</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Tabs')}>
          <Text style={styles.doneBtnText}>Към начало</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Status header */}
      <View style={styles.statusBar}>
        <Text style={styles.statusLabel}>
          {isPickup ? '🚗 Отивам за пътника' : '🛣 Курсът е в ход'}
        </Text>
      </View>

      {/* OSM map — driver position + both route endpoints + locate button */}
      <OsmMap
        center={routeCenter}
        zoom={13}
        markers={[
          ...(myLocation
            ? [{ lat: myLocation.lat, lng: myLocation.lng, label: 'Вие', color: '#1a1a2e' }]
            : []),
          { lat: pickupPoint.lat, lng: pickupPoint.lng, label: 'Начало', color: '#4caf50' },
          { lat: dropoffPoint.lat, lng: dropoffPoint.lng, label: 'Дестинация', color: '#f44336' },
        ]}
        locatePosition={myLocation}
        style={styles.map}
      />

      {/* Bottom panel */}
      <View style={styles.panel}>
        <Text style={styles.addrLabel}>{isPickup ? 'Вземи пътника от:' : 'Карай до:'}</Text>
        <Text style={styles.addr} numberOfLines={2}>{targetAddr}</Text>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Приход</Text>
          <Text style={styles.price}>{parseFloat(order.price_eur).toFixed(2)} EUR</Text>
        </View>

        {isPickup && (
          <TouchableOpacity style={styles.pickupBtn} onPress={handlePickup} disabled={acting}>
            {acting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.pickupBtnText}>✅ Взех пътника — Старт!</Text>
            }
          </TouchableOpacity>
        )}

        {!isPickup && (
          <View style={styles.waitBox}>
            <ActivityIndicator color="#1a1a2e" size="small" />
            <Text style={styles.waitText}>
              {'  '}Чакаме пристигане и потвърждение от пътника...
            </Text>
          </View>
        )}

        {/* IN_PROGRESS: driver may request cancel — passenger must approve */}
        {!isPickup && order.cancel_requested_at && (
          <View style={styles.pendingCancelBox}>
            <Text style={styles.pendingCancelText}>
              ⏳ Чакаме отговор от пътника за заявеното анулиране...
            </Text>
          </View>
        )}

        {!isPickup && !order.cancel_requested_at && (
          <TouchableOpacity style={styles.cancelLink} onPress={handleRequestCancel}>
            <Text style={styles.cancelLinkText}>Заяви анулиране (изисква потвърждение)</Text>
          </TouchableOpacity>
        )}

        {isPickup && (
          <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
            <Text style={styles.cancelLinkText}>Анулирай поръчката</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const NAVY = '#1a1a2e';
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#fff' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBar: {
    padding: 14, backgroundColor: NAVY, alignItems: 'center',
  },
  statusLabel:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  map: { flex: 1 },
  panel: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  addrLabel:  { fontSize: 13, color: '#888', marginBottom: 4 },
  addr:       { fontSize: 15, color: '#333', marginBottom: 12 },
  priceRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  priceLabel: { fontSize: 14, color: '#666' },
  price:      { fontSize: 18, fontWeight: 'bold', color: NAVY },
  pickupBtn: {
    backgroundColor: '#4caf50', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  pickupBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  waitBox:  { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f5f5f5', borderRadius: 12 },
  waitText: { color: '#555', fontSize: 14, flex: 1 },
  cancelLink:     { alignItems: 'center', marginTop: 6 },
  cancelLinkText: { color: '#f44336', fontSize: 13 },
  pendingCancelBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  pendingCancelText: { color: '#e65100', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  // Done screen styles
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  doneIcon:      { fontSize: 64, marginBottom: 16 },
  doneTitle:     { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 12, textAlign: 'center' },
  doneSub:       { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  doneBtn:       { backgroundColor: NAVY, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 16 },
  doneBtnText:   { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
