/**
 * PaymentScreen — Преглед на Lightning invoice + потвърждение на плащане.
 *
 * Показва:
 *   - BOLT11 invoice (QR код или текст за копиране)
 *   - Сума в EUR и сатоши
 *   - Статус: чакане → платено (HELD) → шофьор пристига
 *
 * При DEV_MODE: "Симулирай плащане" бутон.
 * В production: payBolt11Invoice() от Breez SDK.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Clipboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ordersApi } from '@cryptgo/shared';
import { payBolt11Invoice } from '@/services/breez.service';
import { useOrderStore }    from '@/store/useOrderStore';
import type { AppStackParamList, AppNavProp } from '@/navigation/types';

type Route = RouteProp<AppStackParamList, 'Payment'>;

export default function PaymentScreen() {
  const navigation       = useNavigation<AppNavProp>();
  const { params }       = useRoute<Route>();
  const currentOrder     = useOrderStore((s) => s.currentOrder);
  const pendingInvoice   = useOrderStore((s) => s.pendingInvoice);
  const setCurrentOrder  = useOrderStore((s) => s.setCurrentOrder);

  const [paying,  setPaying]  = useState(false);
  const [paid,    setPaid]    = useState(false);
  const [polling, setPolling] = useState<ReturnType<typeof setInterval> | null>(null);

  // Polling за статус на поръчката (HELD → ACCEPTED)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const updated = await ordersApi.findOne(params.orderId);
        setCurrentOrder(updated);
        if (updated.status === 'ACCEPTED' || updated.status === 'IN_PROGRESS') {
          clearInterval(id);
          navigation.replace('Tracking', { orderId: params.orderId });
        }
        if (updated.status === 'CANCELED') {
          clearInterval(id);
          Alert.alert('Анулирано', 'Поръчката е анулирана.');
          navigation.navigate('Tabs');
        }
      } catch { /* тихо */ }
    }, 3_000);

    setPolling(id);
    return () => clearInterval(id);
  }, [params.orderId]);

  const handlePay = async () => {
    if (!pendingInvoice) return;
    setPaying(true);
    try {
      // Breez SDK изпраща плащането (DEV_MODE → stub)
      await payBolt11Invoice(pendingInvoice.bolt11, pendingInvoice.amountSats);
      setPaid(true);
    } catch (err: any) {
      Alert.alert('Грешка при плащане', err.message ?? 'Опитайте отново.');
    } finally {
      setPaying(false);
    }
  };

  const handleCopy = () => {
    if (pendingInvoice?.bolt11) {
      Clipboard.setString(pendingInvoice.bolt11);
      Alert.alert('Копирано', 'Invoice е копиран в клипборда.');
    }
  };

  const handleCancel = async () => {
    Alert.alert('Анулиране', 'Сигурни ли сте?', [
      { text: 'Не', style: 'cancel' },
      {
        text: 'Да, анулирай',
        style: 'destructive',
        onPress: async () => {
          try {
            await ordersApi.cancelByPassenger(params.orderId);
            navigation.navigate('Tabs');
          } catch (e: any) {
            Alert.alert('Грешка', e?.response?.data?.message ?? 'Не може да се анулира.');
          }
        },
      },
    ]);
  };

  if (!pendingInvoice) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F7931A" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>⚡ Lightning Invoice</Text>

      <View style={styles.card}>
        <Text style={styles.amountEur}>
          {parseFloat(currentOrder?.price_eur ?? '0').toFixed(2)} EUR
        </Text>
        <Text style={styles.amountSats}>
          ≈ {pendingInvoice.amountSats.toLocaleString()} сатоши
        </Text>
      </View>

      {/* Invoice (съкратен) */}
      <View style={styles.invoiceBox}>
        <Text style={styles.invoiceText} numberOfLines={3} ellipsizeMode="tail">
          {pendingInvoice.bolt11}
        </Text>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
          <Text style={styles.copyText}>Копирай</Text>
        </TouchableOpacity>
      </View>

      {/* Статус */}
      {paid ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            ✅ Платено! Чакаме потвърждение от Lightning мрежата...
          </Text>
          <ActivityIndicator color="#F7931A" style={{ marginTop: 8 }} />
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={paying}>
            {paying
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.payBtnText}>⚡ Плати сега (Breez SDK)</Text>
            }
          </TouchableOpacity>

          <Text style={styles.hint}>
            В production: Breez SDK автоматично изпраща плащането.
            {'\n'}В DEV режим: натиснете бутона за симулация.
          </Text>
        </>
      )}

      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
        <Text style={styles.cancelText}>Анулирай поръчката</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#fff' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:     { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  card: {
    backgroundColor: '#FFF8F0', borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#F7931A',
  },
  amountEur:  { fontSize: 36, fontWeight: 'bold', color: '#F7931A' },
  amountSats: { fontSize: 16, color: '#666', marginTop: 4 },
  invoiceBox: {
    backgroundColor: '#f5f5f5', borderRadius: 12, padding: 12, marginBottom: 20,
  },
  invoiceText: { fontSize: 12, color: '#666', fontFamily: 'monospace' },
  copyBtn:     { alignItems: 'flex-end', marginTop: 8 },
  copyText:    { color: '#F7931A', fontSize: 13 },
  statusBox:   { alignItems: 'center', padding: 16, marginBottom: 16 },
  statusText:  { textAlign: 'center', color: '#333', fontSize: 15 },
  payBtn: {
    backgroundColor: '#F7931A', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 12,
  },
  payBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  hint: { textAlign: 'center', color: '#999', fontSize: 12, marginBottom: 20 },
  cancelBtn:  { alignItems: 'center', padding: 12 },
  cancelText: { color: '#d32f2f', fontSize: 14 },
});
