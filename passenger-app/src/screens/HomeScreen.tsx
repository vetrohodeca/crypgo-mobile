/**
 * HomeScreen — Главен екран за пътника.
 *
 * Показва:
 *   - OSM карта на цял екран с текущата позиция на пътника
 *   - Маркер на най-близкия свободен шофьор (GEORADIUS)
 *   - Бутон "Заяви курс" → RequestRideScreen
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

  // Центрираме картата при промяна на позицията
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
      // тихо — няма наличен шофьор
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

  const markers = nearestDriver
    ? [{ lat: nearestDriver.lat, lng: nearestDriver.lng, label: `🚕 ${nearestDriver.distanceKm.toFixed(2)} км`, color: '#F7931A' }]
    : [];

  return (
    <View style={styles.container}>
      {/* OSM карта — цял екран */}
      <OsmMap
        ref={mapRef}
        center={center}
        zoom={14}
        markers={markers}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Logout — floating top-right */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Изход</Text>
        </TouchableOpacity>
      </SafeAreaView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },

  topBar: {
    position: 'absolute', top: 0, right: 0, left: 0,
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 16, paddingTop: 8,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4,
    elevation: 3,
  },
  logoutText: { color: '#F7931A', fontWeight: '600', fontSize: 14 },

  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8,
    elevation: 8,
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
