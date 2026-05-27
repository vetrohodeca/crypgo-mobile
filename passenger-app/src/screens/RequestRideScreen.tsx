/**
 * RequestRideScreen — Request a ride.
 *
 * The passenger enters pickup and dropoff addresses.
 * Each field has a 📍 button that opens MapPickerScreen so the passenger
 * can pick the address visually by dragging the map.
 * Backend geocodes -> calculates route -> returns price.
 * After confirmation -> generatePreimage -> initiatePayment -> PaymentScreen.
 *
 * Layout:
 *   - Scrollable content area (title + inputs / route details)
 *   - Fixed bottom panel with the action button (never hidden by keyboard or dropdowns)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ordersApi } from '@cryptgo/shared';
import { generatePreimage } from '@/services/breez.service';
import { savePreimage }    from '@/services/preimageService';
import { useOrderStore }    from '@/store/useOrderStore';
import { useLocation }      from '@cryptgo/shared';
import type { AppNavProp, RequestRideRouteProp } from '@/navigation/types';

export default function RequestRideScreen() {
  const navigation           = useNavigation<AppNavProp>();
  const route                = useRoute<RequestRideRouteProp>();
  const setPaymentInitiated  = useOrderStore((s) => s.setPaymentInitiated);
  const { currentLocation }  = useLocation();

  const [pickup,        setPickup]        = useState('');
  const [dropoff,       setDropoff]       = useState('');
  const [pickupCoords,  setPickupCoords]  = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [order,         setOrder]         = useState<any>(null); // preview after createOrder
  const [step,          setStep]          = useState<'input' | 'confirm' | 'paying'>('input');
  const [loading,       setLoading]       = useState(false);

  // Track the last picked value so we don't re-apply it on every re-render
  const lastPickedKeyRef = useRef<string | null>(null);

  // When the user returns from MapPickerScreen with a chosen address,
  // route.params.picked is set — apply it exactly once per unique pick.
  useEffect(() => {
    const picked = route.params?.picked;
    if (!picked) return;

    const key = `${picked.field}:${picked.lat.toFixed(6)}:${picked.lng.toFixed(6)}`;
    if (lastPickedKeyRef.current === key) return;
    lastPickedKeyRef.current = key;

    if (picked.field === 'pickup') {
      setPickup(picked.address);
      setPickupCoords({ lat: picked.lat, lng: picked.lng });
    } else {
      setDropoff(picked.address);
      setDropoffCoords({ lat: picked.lat, lng: picked.lng });
    }
  }, [route.params?.picked]);

  // ── Open the full-screen map picker for a given field ────────────
  const openMapPicker = (field: 'pickup' | 'dropoff') => {
    // For pickup, start the map at the current GPS position if available.
    // For dropoff, start at existing dropoff coords (if any) or GPS position.
    const coords =
      field === 'pickup'
        ? (pickupCoords ?? currentLocation ?? undefined)
        : (dropoffCoords ?? currentLocation ?? undefined);

    navigation.navigate('MapPicker', {
      field,
      ...(coords ? { initialCoords: coords } : {}),
    });
  };

  // Step 1: Request to backend (geocoding + price)

  const handleCalculate = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      Alert.alert('Грешка', 'Въведете начален и краен адрес.');
      return;
    }
    setLoading(true);
    try {
      const created = await ordersApi.create({
        pickup_address:  pickup.trim(),
        dropoff_address: dropoff.trim(),
        // Pass coordinates to skip geocoding when addresses came from the map picker
        ...(pickupCoords
          ? { pickup_lat: pickupCoords.lat, pickup_lng: pickupCoords.lng }
          : currentLocation
          ? { pickup_lat: currentLocation.lat, pickup_lng: currentLocation.lng }
          : {}),
        ...(dropoffCoords
          ? { dropoff_lat: dropoffCoords.lat, dropoff_lng: dropoffCoords.lng }
          : {}),
      });
      setOrder(created);
      setStep('confirm');
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Не може да се изчисли маршрут.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirmation + preimage generation

  const handleConfirmAndPay = async () => {
    if (!order) return;
    setStep('paying');
    setLoading(true);

    try {
      // Generate preimage LOCALLY — NEVER sent before COMPLETED
      const { preimage, paymentHash } = await generatePreimage();

      // Save preimage in SecureStore IMMEDIATELY — survives app restart / fast refresh
      await savePreimage(order.id, preimage);

      // Send only SHA256(preimage) = paymentHash to the backend
      const resp = await ordersApi.initiatePayment(order.id, {
        payment_hash: paymentHash,
      });

      setPaymentInitiated(resp, preimage, paymentHash);
      navigation.replace('Payment', { orderId: resp.id });
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Не може да се инициира плащане.');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm step ──────────────────────────────────────────────────────────

  if (step === 'confirm' && order) {
    const priceEur = parseFloat(order.price_eur).toFixed(2);
    const km       = (order.distance_meters / 1000).toFixed(1);
    const mins     = Math.round(order.duration_seconds / 60);

    return (
      <SafeAreaView style={styles.container}>
        {/* Scrollable details */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Потвърди курса</Text>

          <View style={styles.card}>
            <Row label="От:"          value={order.pickup_address} />
            <Row label="До:"          value={order.dropoff_address} />
            <Row label="Разстояние:"  value={`${km} км`} />
            <Row label="ETA:"         value={`~${mins} мин`} />
            <View style={styles.divider} />
            <Row label="Цена:" value={`${priceEur} EUR`} bold />
            <Text style={styles.hint}>≈ {Math.round(parseFloat(priceEur) * 1200)} сатоши</Text>
          </View>

          <Text style={styles.secNote}>
            🔒 Плащането е escrow — средствата се освобождават при пристигане.
          </Text>
        </ScrollView>

        {/* Fixed bottom panel — always visible */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleConfirmAndPay} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Плати с Lightning ⚡</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep('input')}>
            <Text style={styles.cancelText}>← Обратно</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Input step ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Scrollable form fields */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Заяви курс</Text>

          {/* Pickup field */}
          <Text style={styles.label}>Начален адрес</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="напр. ул. Витоша 1, София"
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              value={pickup}
              onChangeText={(t) => { setPickup(t); setPickupCoords(null); }}
              returnKeyType="next"
            />
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => openMapPicker('pickup')}
              accessibilityLabel="Избери начален адрес от карта"
            >
              <Text style={styles.mapBtnText}>📍</Text>
            </TouchableOpacity>
          </View>

          {/* Dropoff field */}
          <Text style={styles.label}>Краен адрес</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="напр. Летище София"
              autoCorrect={false}
              autoComplete="off"
              autoCapitalize="none"
              value={dropoff}
              onChangeText={(t) => { setDropoff(t); setDropoffCoords(null); }}
              returnKeyType="done"
              onSubmitEditing={handleCalculate}
            />
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => openMapPicker('dropoff')}
              accessibilityLabel="Избери краен адрес от карта"
            >
              <Text style={styles.mapBtnText}>📍</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Fixed bottom panel — stays above the keyboard */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleCalculate} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Изчисли маршрут →</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelText}>Отказ</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 }}>
      <Text style={{ color: '#666', fontSize: 15 }}>{label}</Text>
      <Text style={{ color: '#333', fontSize: 15, fontWeight: bold ? 'bold' : 'normal' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 20 },

  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },

  // Input row: text field + map-picker button side by side
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, fontSize: 16,
  },
  mapBtn: {
    marginLeft: 8,
    backgroundColor: '#fff5eb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F7931A',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapBtnText: { fontSize: 20 },

  card: {
    backgroundColor: '#f9f9f9', borderRadius: 16,
    padding: 16, marginBottom: 16,
  },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  hint:    { textAlign: 'right', color: '#999', fontSize: 12, marginTop: 2 },
  secNote: { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 16 },

  // Fixed bottom panel — mirrors the driver app panel style
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  btn: {
    backgroundColor: '#F7931A', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  btnText:    { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn:  { alignItems: 'center', padding: 10 },
  cancelText: { color: '#999', fontSize: 14 },
});
