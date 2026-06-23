import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { feedbackApi, ordersApi } from '@crypgo/shared';
import type { FeedbackCategory, Order } from '@crypgo/shared';
import type { AppNavProp } from '../navigation/types';

// ── Categories shown to the driver ────────────────────────────────────
const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'LOST_ITEM',         label: '🧳 Забравена вещ (в колата)' },
  { value: 'PASSENGER_FEEDBACK', label: '🧑 За пътника' },
  { value: 'APP_FEEDBACK',      label: '📱 За приложението' },
];

const ACCENT = '#e67e22';

function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bg-BG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function FeedbackScreen() {
  const navigation = useNavigation<AppNavProp>();

  const [category, setCategory] = useState<FeedbackCategory>('LOST_ITEM');
  const [title, setTitle]       = useState('');
  const [body, setBody]         = useState('');
  const [linkedOrder, setLinkedOrder] = useState<Order | null>(null);
  const [saving, setSaving]     = useState(false);

  // Order picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orders, setOrders]         = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    setOrdersLoading(true);
    ordersApi
      .driverOrders()
      .then(setOrders)
      .catch(() => Alert.alert('Грешка', 'Поръчките не можаха да се заредят.'))
      .finally(() => setOrdersLoading(false));
  }, []);

  const pickOrder = useCallback((order: Order) => {
    setLinkedOrder(order);
    setPickerOpen(false);
  }, []);

  // App feedback is not tied to a specific order — clear any linked order.
  const selectCategory = useCallback((value: FeedbackCategory) => {
    setCategory(value);
    if (value === 'APP_FEEDBACK') setLinkedOrder(null);
  }, []);

  const submit = useCallback(async () => {
    const t = title.trim();
    const b = body.trim();
    if (t.length < 3) {
      Alert.alert('Грешка', 'Заглавието трябва да е поне 3 символа.');
      return;
    }
    if (b.length < 5) {
      Alert.alert('Грешка', 'Съобщението трябва да е поне 5 символа.');
      return;
    }

    setSaving(true);
    try {
      await feedbackApi.submit({
        category,
        title: t,
        body: b,
        order_id: linkedOrder?.id,
      });
      Alert.alert('Изпратено', 'Благодарим! Съобщението е изпратено до администрацията.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Грешка', 'Съобщението не можа да се изпрати. Опитайте отново.');
    } finally {
      setSaving(false);
    }
  }, [category, title, body, linkedOrder, navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>✉️ Обратна връзка</Text>

      {/* ── Category ──────────────────────────────────────────────── */}
      <Text style={styles.label}>Тип</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => {
          const active = c.value === category;
          return (
            <TouchableOpacity
              key={c.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => selectCategory(c.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Title ─────────────────────────────────────────────────── */}
      <Text style={styles.label}>Заглавие</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Кратко заглавие"
        placeholderTextColor="#aaa"
        maxLength={120}
      />

      {/* ── Body ──────────────────────────────────────────────────── */}
      <Text style={styles.label}>Съобщение</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={body}
        onChangeText={setBody}
        placeholder="Опишете подробно..."
        placeholderTextColor="#aaa"
        maxLength={2000}
        multiline
        textAlignVertical="top"
      />

      {/* ── Optional order link (not shown for app feedback) ──────── */}
      {category !== 'APP_FEEDBACK' && (
        <>
          <Text style={styles.label}>Свързана поръчка (по избор)</Text>
          {linkedOrder ? (
            <View style={styles.linkedCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkedRoute} numberOfLines={1}>
                  {linkedOrder.pickup_address} → {linkedOrder.dropoff_address}
                </Text>
                <Text style={styles.linkedMeta}>
                  {formatOrderDate(linkedOrder.created_at)} · {linkedOrder.status}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setLinkedOrder(null)}>
                <Text style={styles.clearLink}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.linkBtn} onPress={openPicker}>
              <Text style={styles.linkBtnText}>+ Свържи поръчка</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* ── Submit ────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.btnDisabled]}
        onPress={submit}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>Изпрати</Text>}
      </TouchableOpacity>

      {/* ── Order picker modal ────────────────────────────────────── */}
      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Избери поръчка</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Text style={styles.modalClose}>Затвори</Text>
              </TouchableOpacity>
            </View>

            {ordersLoading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
            ) : orders.length === 0 ? (
              <Text style={styles.emptyText}>Няма поръчки.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {orders.map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={styles.orderRow}
                    onPress={() => pickOrder(o)}
                  >
                    <Text style={styles.orderRoute} numberOfLines={1}>
                      {o.pickup_address} → {o.dropoff_address}
                    </Text>
                    <Text style={styles.orderMeta}>
                      {formatOrderDate(o.created_at)} · {o.status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content:   { padding: 20, paddingTop: 56, paddingBottom: 40 },

  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 6,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: ACCENT,
    backgroundColor: '#fff3e0',
  },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: ACCENT },

  // Inputs
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  textarea: { minHeight: 120 },

  // Order link
  linkBtn: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  linkBtnText: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  linkedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  linkedRoute: { fontSize: 14, color: '#222', fontWeight: '600' },
  linkedMeta:  { fontSize: 12, color: '#888', marginTop: 2 },
  clearLink:   { fontSize: 18, color: '#e74c3c', paddingHorizontal: 6 },

  // Submit
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  modalClose: { fontSize: 14, color: ACCENT, fontWeight: '600' },
  emptyText:  { textAlign: 'center', color: '#999', marginVertical: 24 },
  orderRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderRoute: { fontSize: 14, color: '#222', fontWeight: '600' },
  orderMeta:  { fontSize: 12, color: '#888', marginTop: 2 },
});
