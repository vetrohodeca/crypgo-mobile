/**
 * MapPickerScreen — full-screen map for picking a pickup or dropoff address.
 *
 * Usage flow:
 *   1. Opened from RequestRideScreen with { field: 'pickup'|'dropoff', initialCoords? }
 *   2. User drags the map — the crosshair (⊕) always marks the centre
 *   3. On each drag-end the backend reverse-geocodes the centre (debounced 600 ms)
 *   4. The built-in locate button (⊙, bottom-right) snaps the map to the GPS position
 *   5. "Confirm" navigates back to RequestRideScreen with the chosen address + coords
 *
 * The `center` prop passed to OsmMap is intentionally kept constant (initialCenter) so
 * the map never re-centres programmatically while the user drags.  Programmatic panning
 * goes through mapRef.panTo() which triggers the moveend → onCenterChange → liveCenter
 * pipeline; this keeps the confirm data and the reverse-geocode in sync.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import * as ExpoLocation from 'expo-location';
import { OsmMap, mapsApi } from '@cryptgo/shared';
import type { OsmMapRef } from '@cryptgo/shared';
import type { AppNavProp, AppStackParamList } from '@/navigation/types';

type MapPickerRouteProp = RouteProp<AppStackParamList, 'MapPicker'>;

const SOFIA_CENTER = { lat: 42.6977, lng: 23.3219 };
const DEBOUNCE_MS  = 600;

export default function MapPickerScreen() {
  const navigation = useNavigation<AppNavProp>();
  const route      = useRoute<MapPickerRouteProp>();
  const { field, initialCoords } = route.params;

  // Fixed initial centre for OsmMap — never updated to prevent map fighting user drags
  const [initialCenter]           = useState(initialCoords ?? SOFIA_CENTER);
  // Live centre tracked via onCenterChange (separate from the OsmMap prop)
  const [liveCenter, setLiveCenter] = useState(initialCenter);

  const [address,     setAddress]     = useState('');
  const [geocoding,   setGeocoding]   = useState(false);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef     = useRef<OsmMapRef>(null);
  const mountedRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── GPS — only needed for the built-in locate button ────────────
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mountedRef.current) return;
      try {
        const loc = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        if (mountedRef.current) {
          setGpsLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch { /* GPS not available — locate button will stay disabled */ }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  // ── Initial reverse geocode for the starting centre ─────────────
  useEffect(() => {
    doReverseGeocode(initialCenter.lat, initialCenter.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doReverseGeocode = async (lat: number, lng: number) => {
    if (!mountedRef.current) return;
    setGeocoding(true);
    try {
      const result = await mapsApi.reverseGeocode(lat, lng);
      if (mountedRef.current) setAddress(result.display_name);
    } catch {
      if (mountedRef.current) setAddress('');
    } finally {
      if (mountedRef.current) setGeocoding(false);
    }
  };

  // ── Called by OsmMap on every moveend event ──────────────────────
  const handleCenterChange = useCallback((lat: number, lng: number) => {
    setLiveCenter({ lat, lng });
    // Debounce — wait until the map stops moving before geocoding
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doReverseGeocode(lat, lng), DEBOUNCE_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Snap map to GPS and reverse-geocode immediately ─────────────
  const handleUseMyLocation = () => {
    if (!gpsLocation) return;
    // Cancel any pending debounce — we want an instant geocode
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLiveCenter(gpsLocation);
    mapRef.current?.panTo(gpsLocation.lat, gpsLocation.lng, 16);
    doReverseGeocode(gpsLocation.lat, gpsLocation.lng);
  };

  // ── Confirm — pass chosen address back to RequestRideScreen ─────
  const handleConfirm = () => {
    if (!address) return;
    navigation.navigate('RequestRide', {
      picked: {
        field,
        address,
        lat: liveCenter.lat,
        lng: liveCenter.lng,
      },
    });
  };

  const fieldLabel = field === 'pickup' ? 'начален адрес' : 'краен адрес';

  return (
    <View style={styles.container}>

      {/* Full-screen map — centre never changes so user drag is not overridden */}
      <OsmMap
        ref={mapRef}
        center={initialCenter}
        zoom={15}
        style={styles.map}
        onCenterChange={handleCenterChange}
        locatePosition={gpsLocation}
      />

      {/* Crosshair pinned to the visual centre of the map */}
      <View style={styles.crosshairWrapper} pointerEvents="none">
        <Text style={styles.crosshairText}>⊕</Text>
      </View>

      {/* Top bar — back button + address label */}
      <SafeAreaView style={styles.topBarSafe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>
            {field === 'pickup' ? '📍 Начален адрес' : '🏁 Краен адрес'}
          </Text>
        </View>
        {/* Address resolved from the current crosshair position */}
        <View style={styles.addressBar}>
          {geocoding ? (
            <ActivityIndicator size="small" color="#F7931A" />
          ) : (
            <Text style={styles.addressText} numberOfLines={2}>
              {address || 'Преместете картата…'}
            </Text>
          )}
        </View>
      </SafeAreaView>

      {/* Fixed bottom panel */}
      <SafeAreaView style={styles.bottomSafe} edges={['bottom']}>
        {/* "Use my location" — prominent button, visible as soon as GPS is acquired */}
        {gpsLocation && (
          <TouchableOpacity style={styles.gpsBtn} onPress={handleUseMyLocation}>
            <Text style={styles.gpsBtnText}>📍 Използвай моята локация</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, (!address || geocoding) && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!address || geocoding}
        >
          <Text style={styles.confirmBtnText}>
            ✓ Потвърди {fieldLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Отказ</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  // Crosshair — absolute centre of the screen
  crosshairWrapper: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  crosshairText: {
    fontSize: 36,
    color: '#1a1a2e',
    // Semi-transparent shadow so it's readable over any map tile colour
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  // Top bar — address label
  topBarSafe: {
    position: 'absolute', top: 0, left: 0, right: 0,
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(26,26,46,0.92)',
  },
  backBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    marginRight: 8,
  },
  backBtnText: { color: '#F7931A', fontWeight: '600', fontSize: 14 },
  topTitle: {
    flex: 1, color: '#fff',
    fontWeight: '700', fontSize: 15,
  },
  addressBar: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16, paddingVertical: 10,
    minHeight: 44, justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  addressText: { color: '#333', fontSize: 13, lineHeight: 18 },

  // Bottom panel
  bottomSafe: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    paddingHorizontal: 16, paddingTop: 12,
  },
  // "Use my location" button — outlined style, distinct from the primary confirm
  gpsBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F7931A',
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    backgroundColor: '#fff5eb',
  },
  gpsBtnText: { color: '#F7931A', fontWeight: '700', fontSize: 15 },

  confirmBtn: {
    backgroundColor: '#F7931A', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 8,
  },
  confirmBtnDisabled: { backgroundColor: '#ccc' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn:  { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: '#999', fontSize: 14 },
});
