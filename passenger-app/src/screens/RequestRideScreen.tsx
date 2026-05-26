/**
 * RequestRideScreen — Заявка на курс.
 *
 * Пътникът въвежда адреси за pickup и dropoff.
 * Backend-ът геокодира → изчислява маршрут → връща цена.
 * След потвърждение → generatePreimage → initiatePayment → PaymentScreen.
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ordersApi } from '@cryptgo/shared';
import { generatePreimage } from '@/services/breez.service';
import { useOrderStore }    from '@/store/useOrderStore';
import { useLocation }      from '@cryptgo/shared';
import type { AppNavProp }  from '@/navigation/types';

export default function RequestRideScreen() {
  const navigation           = useNavigation<AppNavProp>();
  const setPaymentInitiated  = useOrderStore((s) => s.setPaymentInitiated);
  const { currentLocation }  = useLocation();

  const [pickup,    setPickup]   = useState('');
  const [dropoff,   setDropoff]  = useState('');
  const [order,     setOrder]    = useState<any>(null); // preview след createOrder
  const [step,      setStep]     = useState<'input' | 'confirm' | 'paying'>('input');
  const [loading,   setLoading]  = useState(false);

  // ── Стъпка 1: Заявка към backend (геокодиране + цена) ─────────────

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
        // Ако имаме GPS — подаваме координатите директно (без геокодиране)
        ...(currentLocation
          ? { pickup_lat: currentLocation.lat, pickup_lng: currentLocation.lng }
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

  // ── Стъпка 2: Потвърждение + генериране на preimage ──────────────

  const handleConfirmAndPay = async () => {
    if (!order) return;
    setStep('paying');
    setLoading(true);

    try {
      // Генерираме preimage ЛОКАЛНО — НИКОГА не се изпраща преди COMPLETED
      const { preimage, paymentHash } = await generatePreimage();

      // Изпращаме само SHA256(preimage) = paymentHash към backend-а
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

  // ── UI ────────────────────────────────────────────────────────────

  if (step === 'confirm' && order) {
    const priceEur = parseFloat(order.price_eur).toFixed(2);
    const km       = (order.distance_meters / 1000).toFixed(1);
    const mins     = Math.round(order.duration_seconds / 60);

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Потвърди курса</Text>

        <View style={styles.card}>
          <Row label="От:"   value={order.pickup_address} />
          <Row label="До:"   value={order.dropoff_address} />
          <Row label="Разстояние:" value={`${km} км`} />
          <Row label="ETA:"  value={`~${mins} мин`} />
          <View style={styles.divider} />
          <Row label="Цена:" value={`${priceEur} EUR`} bold />
          <Text style={styles.hint}>≈ {Math.round(parseFloat(priceEur) * 1200)} сатоши</Text>
        </View>

        <Text style={styles.secNote}>
          🔒 Плащането е escrow — средствата се освобождават при пристигане.
        </Text>

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
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Заяви курс</Text>

        <Text style={styles.label}>Начален адрес</Text>
        <TextInput
          style={styles.input}
          placeholder="напр. ул. Витоша 1, София"
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="sentences"
          value={pickup}
          onChangeText={setPickup}
          returnKeyType="next"
        />

        <Text style={styles.label}>Краен адрес</Text>
        <TextInput
          style={styles.input}
          placeholder="напр. Летище София"
          autoCorrect={false}
          autoComplete="off"
          autoCapitalize="sentences"
          value={dropoff}
          onChangeText={setDropoff}
          returnKeyType="done"
          onSubmitEditing={handleCalculate}
        />

        <TouchableOpacity style={styles.btn} onPress={handleCalculate} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Изчисли маршрут →</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Отказ</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff' },
  title:     { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  label:     { fontSize: 14, color: '#666', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, marginBottom: 16, fontSize: 16,
  },
  card: {
    backgroundColor: '#f9f9f9', borderRadius: 16,
    padding: 16, marginBottom: 16,
  },
  divider:  { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  hint:     { textAlign: 'right', color: '#999', fontSize: 12, marginTop: 2 },
  secNote:  { color: '#666', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  btn: {
    backgroundColor: '#F7931A', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  btnText:    { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn:  { alignItems: 'center', padding: 10 },
  cancelText: { color: '#999', fontSize: 14 },
});
