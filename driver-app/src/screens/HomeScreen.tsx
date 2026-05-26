/**
 * HomeScreen — Главен екран за шофьора.
 *
 * Функционалности:
 *   - OFFLINE ↔ AVAILABLE toggle
 *   - При AVAILABLE: стартира фонов GPS стрийм → WebSocket → Redis GEOADD
 *   - Карта с текущата позиция
 *   - При активен курс → redirect към ActiveRide
 */
import React, { useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { useLocation }   from '@cryptgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { useDriverStore } from '@/store/useDriverStore';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  emitLocation,
  destroyDriverSocket,
} from '@/services/backgroundLocation.service';
import type { AppNavProp } from '@/navigation/types';

const SOFIA = { latitude: 42.6977, longitude: 23.3219 };

export default function HomeScreen() {
  const navigation   = useNavigation<AppNavProp>();
  const user         = useAuthStore((s) => s.user);
  const logout       = useAuthStore((s) => s.logout);
  const status       = useDriverStore((s) => s.status);
  const setStatus    = useDriverStore((s) => s.setStatus);
  const activeOrder  = useDriverStore((s) => s.activeOrder);
  const setGpsTrk    = useDriverStore((s) => s.setGpsTracking);

  const isAvailable  = status === 'AVAILABLE' || status === 'BUSY';

  // GPS hook — foreground fallback
  const { currentLocation, requestPermission, startTracking, stopTracking } = useLocation({
    intervalMs: 3_000,
    onUpdate: (coords) => {
      if (isAvailable) emitLocation(coords.lat, coords.lng);
    },
  });

  // При активен курс → навигираме към ActiveRide
  useEffect(() => {
    if (activeOrder?.status === 'ACCEPTED' || activeOrder?.status === 'IN_PROGRESS') {
      navigation.navigate('ActiveRide', { orderId: activeOrder.id });
    }
  }, [activeOrder]);

  // ── Toggle OFFLINE ↔ AVAILABLE ──────────────────────────────────

  const handleToggle = useCallback(async (value: boolean) => {
    const newStatus = value ? 'AVAILABLE' : 'OFFLINE';

    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('GPS', 'Нужен е достъп до GPS за да приемате поръчки.');
        return;
      }
      const bgStarted = await startBackgroundTracking();
      if (!bgStarted) {
        // Foreground fallback
        await startTracking();
      }
      setGpsTrk(true);
    } else {
      await stopBackgroundTracking();
      stopTracking();
      setGpsTrk(false);
    }

    await setStatus(newStatus as any);
  }, [requestPermission, startTracking, stopTracking, setGpsTrk, setStatus]);

  const handleLogout = () => {
    stopBackgroundTracking();
    destroyDriverSocket();
    logout();
  };

  const region = currentLocation
    ? { latitude: currentLocation.lat, longitude: currentLocation.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { ...SOFIA, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>🚕 {user?.name?.split(' ')[0]}</Text>
          <View style={[styles.badge, isAvailable ? styles.badgeGreen : styles.badgeGray]}>
            <Text style={styles.badgeText}>{isAvailable ? '● ОНЛАЙН' : '○ ОФЛАЙН'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Изход</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        showsUserLocation
        showsMyLocationButton
      >
        {currentLocation && (
          <Marker
            coordinate={{ latitude: currentLocation.lat, longitude: currentLocation.lng }}
            title="Моята позиция"
          >
            <Text style={{ fontSize: 28 }}>🚕</Text>
          </Marker>
        )}
      </MapView>

      {/* Bottom panel */}
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>
          {isAvailable ? 'Готов за поръчки' : 'Превключи за да приемаш поръчки'}
        </Text>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, !isAvailable && styles.toggleLabelActive]}>
            ОФЛАЙН
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={handleToggle}
            trackColor={{ false: '#ccc', true: '#4caf50' }}
            thumbColor={isAvailable ? '#fff' : '#fff'}
            style={{ marginHorizontal: 12 }}
          />
          <Text style={[styles.toggleLabel, isAvailable && styles.toggleLabelActive]}>
            ОНЛАЙН
          </Text>
        </View>

        {isAvailable && (
          <Text style={styles.hint}>
            GPS стрийм активен — видими сте за пътниците
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const NAVY = '#1a1a2e';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  greeting:   { fontSize: 18, fontWeight: '600', color: '#333' },
  badge:      { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeGreen: { backgroundColor: '#e8f5e9' },
  badgeGray:  { backgroundColor: '#f5f5f5' },
  badgeText:  { fontSize: 11, fontWeight: '700' },
  logoutText: { color: NAVY, fontSize: 14 },
  map:        { flex: 1 },
  panel: {
    padding: 20, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  panelLabel: { fontSize: 15, color: '#555', marginBottom: 16 },
  toggleRow:  { flexDirection: 'row', alignItems: 'center' },
  toggleLabel: { fontSize: 14, color: '#bbb', fontWeight: '600' },
  toggleLabelActive: { color: NAVY },
  hint: { fontSize: 12, color: '#4caf50', marginTop: 12, textAlign: 'center' },
});
