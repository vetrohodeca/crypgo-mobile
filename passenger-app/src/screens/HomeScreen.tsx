/**
 * HomeScreen — Главен екран за пътника.
 *
 * Показва:
 *   - Карта (MapView) с текущата позиция на пътника
 *   - Маркер на най-близкия свободен шофьор (GEORADIUS)
 *   - Бутон "Заяви курс" → RequestRideScreen
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { locationApi } from '@cryptgo/shared';
import type { NearestDriverResult } from '@cryptgo/shared';
import { useLocation } from '@cryptgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { useOrderStore } from '@/store/useOrderStore';
import type { AppNavProp } from '@/navigation/types';

const SOFIA = { latitude: 42.6977, longitude: 23.3219 };

export default function HomeScreen() {
  const navigation    = useNavigation<AppNavProp>();
  const logout        = useAuthStore((s) => s.logout);
  const user          = useAuthStore((s) => s.user);
  const currentOrder  = useOrderStore((s) => s.currentOrder);

  const [nearestDriver, setNearestDriver] = useState<NearestDriverResult | null>(null);
  const [loadingDriver, setLoadingDriver] = useState(false);

  const { currentLocation, hasPermission, requestPermission, getCurrentPosition } = useLocation();

  // Заявяме разрешения и взимаме начална позиция
  useEffect(() => {
    (async () => {
      const granted = await requestPermission();
      if (granted) await getCurrentPosition();
    })();
  }, []);

  // Търсим най-близкия шофьор на всеки 10с
  const fetchNearestDriver = useCallback(async () => {
    if (!currentLocation) return;
    setLoadingDriver(true);
    try {
      const driver = await locationApi.nearestDriver(
        currentLocation.lat,
        currentLocation.lng,
      );
      setNearestDriver(driver);
    } catch {
      // Тихо — няма наличен шофьор
    } finally {
      setLoadingDriver(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    fetchNearestDriver();
    const interval = setInterval(fetchNearestDriver, 10_000);
    return () => clearInterval(interval);
  }, [fetchNearestDriver]);

  // Ако има активна поръчка в IN_PROGRESS — директно към Tracking
  useEffect(() => {
    if (currentOrder?.status === 'IN_PROGRESS' || currentOrder?.status === 'ACCEPTED') {
      navigation.navigate('Tracking', { orderId: currentOrder.id });
    }
    if (currentOrder?.status === 'HELD') {
      navigation.navigate('Payment', { orderId: currentOrder.id });
    }
  }, [currentOrder]);

  const mapRegion = currentLocation
    ? {
        latitude:       currentLocation.lat,
        longitude:      currentLocation.lng,
        latitudeDelta:  0.02,
        longitudeDelta: 0.02,
      }
    : { ...SOFIA, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Здравей, {user?.name?.split(' ')[0]} ₿</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Изход</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={mapRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {nearestDriver && (
          <Marker
            coordinate={{
              latitude:  nearestDriver.lat,
              longitude: nearestDriver.lng,
            }}
            title="Свободен шофьор"
            description={`${nearestDriver.distanceKm.toFixed(2)} км от вас`}
          >
            <Text style={styles.driverEmoji}>🚕</Text>
          </Marker>
        )}
      </MapView>

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
          <Text style={styles.permText}>
            Нужен е достъп до GPS за да заявите курс.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  greeting:    { fontSize: 18, fontWeight: '600', color: '#333' },
  logoutText:  { color: '#F7931A', fontSize: 14 },
  map:         { flex: 1 },
  driverEmoji: { fontSize: 28 },
  panel: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
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
