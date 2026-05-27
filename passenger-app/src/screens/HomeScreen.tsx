/**
 * HomeScreen — Main screen for the passenger.
 *
 * Displays:
 *   - OSM map with the passenger's current position
 *   - Marker for the nearest available driver (GEORADIUS)
 *   - "Request Ride" button -> RequestRideScreen
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { locationApi, OsmMap } from '@cryptgo/shared';
import type { NearestDriverResult, OsmMapRef } from '@cryptgo/shared';
import { useLocation }   from '@cryptgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { useOrderStore } from '@/store/useOrderStore';
import type { AppNavProp } from '@/navigation/types';

const SOFIA = { lat: 42.6977, lng: 23.3219 };

export default function HomeScreen() {
  const navigation   = useNavigation<AppNavProp>();
  const logout       = useAuthStore((s) => s.logout);
  const currentOrder = useOrderStore((s) => s.currentOrder);
  const mapRef       = useRef<OsmMapRef>(null);

  const [nearestDriver, setNearestDriver] = useState<NearestDriverResult | null>(null);
  const [loadingDriver, setLoadingDriver] = useState(false);

  const { currentLocation, hasPermission, requestPermission, getCurrentPosition } = useLocation();

  useEffect(() => {
    (async () => {
      const granted = await requestPermission();
      if (granted) await getCurrentPosition();
    })();
  }, []);

  // Re-centre the map when the position changes
  useEffect(() => {
    if (currentLocation) {
      mapRef.current?.panTo(currentLocation.lat, currentLocation.lng, 15);
    }
  }, [currentLocation]);

  const fetchNearestDriver = useCallback(async () => {
    if (!currentLocation) return;
    setLoadingDriver(true);
    try {
      const driver = await locationApi.nearestDriver(currentLocation.lat, currentLocation.lng);
      setNearestDriver(driver);
    } catch {
      // silent — no available driver
    } finally {
      setLoadingDriver(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    fetchNearestDriver();
    const id = setInterval(fetchNearestDriver, 10_000);
    return () => clearInterval(id);
  }, [fetchNearestDriver]);

  useEffect(() => {
    if (currentOrder?.status === 'IN_PROGRESS' || currentOrder?.status === 'ACCEPTED') {
      navigation.navigate('Tracking', { orderId: currentOrder.id });
    }
    if (currentOrder?.status === 'HELD') {
      navigation.navigate('Payment', { orderId: currentOrder.id });
    }
  }, [currentOrder]);

  const center = currentLocation ?? SOFIA;

  const markers = [
    // Passenger's own position
    ...(currentLocation
      ? [{ lat: currentLocation.lat, lng: currentLocation.lng, label: '📍 Вие', color: '#2196F3' }]
      : []),
    // Nearest available driver
    ...(nearestDriver
      ? [{ lat: nearestDriver.lat, lng: nearestDriver.lng, label: `🚕 ${nearestDriver.distanceKm.toFixed(2)} км`, color: '#F7931A' }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺 CrypGo</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Изход</Text>
        </TouchableOpacity>
      </View>

      {/* OSM map — flex: 1, same pattern as TrackingScreen */}
      <OsmMap
        ref={mapRef}
        center={center}
        zoom={14}
        markers={markers}
        style={styles.map}
      />

      {/* Bottom panel */}
      <View style={styles.panel}>
        {loadingDriver ? (
          <ActivityIndicator color="#F7931A" style={{ marginBottom: 8 }} />
        ) : nearestDriver ? (
          <Text style={styles.driverInfo}>
            🚕 Шофьор на {nearestDriver.distanceKm.toFixed(2)} км
          </Text>
        ) : (
          <Text style={styles.noDriver}>Няма свободен шофьор наблизо</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, !hasPermission && styles.btnDisabled]}
          onPress={() => navigation.navigate('RequestRide')}
          disabled={!hasPermission}
        >
          <Text style={styles.btnText}>🗺 Заяви курс</Text>
        </TouchableOpacity>

        {!hasPermission && (
          <Text style={styles.permText}>Нужен е достъп до GPS за да заявите курс.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  logoutBtn: {
    backgroundColor: '#fff5eb', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  logoutText: { color: '#F7931A', fontWeight: '600', fontSize: 14 },

  // flex: 1 — map fills all space between header and panel
  map: { flex: 1 },

  panel: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  driverInfo: { textAlign: 'center', color: '#333', marginBottom: 12, fontSize: 15 },
  noDriver:   { textAlign: 'center', color: '#999', marginBottom: 12, fontSize: 14 },
  btn: {
    backgroundColor: '#F7931A', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#ccc' },
  btnText:     { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  permText:    { textAlign: 'center', color: '#999', fontSize: 12, marginTop: 8 },
});
