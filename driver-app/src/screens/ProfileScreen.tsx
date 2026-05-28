import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { driversApi } from '@crypgo/shared';
import type { Driver } from '@crypgo/shared';
import { useAuthStore } from '../store/useAuthStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function formatRating(rating: number | null | undefined): string {
  // Ratings are 1-5; treat 0 as "no rating" too (defensive — backend
  // shouldn't emit 0, but guards against odd DB state from manual seeds).
  if (rating == null || rating <= 0) return 'Няма още';
  return `⭐ ${rating.toFixed(1)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);

  const [driver, setDriver]         = useState<Driver | null>(null);
  const [loading, setLoading]       = useState(true);
  const [editMode, setEditMode]     = useState(false);
  const [saving, setSaving]         = useState(false);

  // Edit-mode form state
  const [carModel, setCarModel]         = useState('');
  const [licensePlate, setLicensePlate] = useState('');

  // ── Load profile on mount ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await driversApi.getProfile();
        if (!cancelled) {
          setDriver(data);
          setCarModel(data.car_model ?? '');
          setLicensePlate(data.license_plate ?? '');
        }
      } catch {
        if (!cancelled) {
          Alert.alert('Грешка', 'Не можа да се зареди профилът. Опитайте отново.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Enter edit mode ─────────────────────────────────────────────────────────
  const startEdit = useCallback(() => {
    if (!driver) return;
    setCarModel(driver.car_model ?? '');
    setLicensePlate(driver.license_plate ?? '');
    setEditMode(true);
  }, [driver]);

  const cancelEdit = useCallback(() => {
    setEditMode(false);
  }, []);

  // ── Save car update ─────────────────────────────────────────────────────────
  const saveCar = useCallback(async () => {
    const trimmedModel = carModel.trim();
    const trimmedPlate = licensePlate.trim().toUpperCase();

    if (!trimmedModel) {
      Alert.alert('Грешка', 'Моля въведете модел на автомобила.');
      return;
    }
    if (!/^[A-Z]{1,2}[0-9]{4}[A-Z]{1,2}$/.test(trimmedPlate)) {
      Alert.alert('Грешка', 'Невалиден регистрационен номер.\nФормат: 1-2 букви, 4 цифри, 1-2 букви. Пример: CA1234AB');
      return;
    }

    setSaving(true);
    try {
      const updated = await driversApi.updateCar({
        car_model: trimmedModel,
        license_plate: trimmedPlate,
      });
      setDriver(updated);
      setEditMode(false);
    } catch (err: any) {
      // 409 Conflict — plate taken by another driver
      if (err?.response?.status === 409) {
        Alert.alert('Заето', 'Този регистрационен номер се използва от друг шофьор.');
      } else {
        Alert.alert('Грешка', 'Не можа да се запазят промените. Опитайте отново.');
      }
    } finally {
      setSaving(false);
    }
  }, [carModel, licensePlate]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert('Изход', 'Сигурни ли сте, че искате да излезете?', [
      { text: 'Отказ', style: 'cancel' },
      { text: 'Изход', style: 'destructive', onPress: logout },
    ]);
  }, [logout]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e67e22" />
      </View>
    );
  }

  if (!driver) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Профилът не може да се зареди.</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Изход</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <Text style={styles.screenTitle}>👤 Профил</Text>

      {/* ── Avatar + Identity ──────────────────────────────────────── */}
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(driver.name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <Text style={styles.driverPhone}>{driver.phone}</Text>
        </View>
      </View>

      {/* ── Rating + Approval ──────────────────────────────────────── */}
      <View style={styles.infoCardRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardLabel}>Рейтинг</Text>
          <Text style={styles.infoCardValue}>{formatRating(driver.rating)}</Text>
        </View>
        <View style={[styles.infoCard, driver.is_approved ? styles.infoCardGreen : styles.infoCardOrange]}>
          <Text style={styles.infoCardLabel}>Статус</Text>
          <Text style={styles.infoCardValue}>
            {driver.is_approved ? '✅ Одобрен' : '⏳ Чака одобрение'}
          </Text>
        </View>
      </View>

      {/* ── Car section ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🚗 Автомобил</Text>
          {!editMode && (
            <TouchableOpacity onPress={startEdit}>
              <Text style={styles.editLink}>Промени</Text>
            </TouchableOpacity>
          )}
        </View>

        {editMode ? (
          /* ── Edit mode ─────────────────────────────────────────── */
          <>
            <Text style={styles.fieldLabel}>Марка и модел</Text>
            <TextInput
              style={styles.input}
              value={carModel}
              onChangeText={setCarModel}
              placeholder="напр. Toyota Corolla 2022"
              placeholderTextColor="#aaa"
              maxLength={50}
              returnKeyType="next"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Регистрационен номер</Text>
            <TextInput
              style={styles.input}
              value={licensePlate}
              onChangeText={(t) => setLicensePlate(t.toUpperCase())}
              placeholder="напр. CA1234AB"
              placeholderTextColor="#aaa"
              maxLength={15}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={saveCar}
            />

            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.btnSave, saving && styles.btnDisabled]}
                onPress={saveCar}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnSaveText}>Запази</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={cancelEdit} disabled={saving}>
                <Text style={styles.btnCancelText}>Отказ</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ── View mode ─────────────────────────────────────────── */
          <>
            <Text style={styles.fieldValue}>{driver.car_model || '—'}</Text>
            <Text style={styles.plateValue}>{driver.license_plate || '—'}</Text>
          </>
        )}
      </View>

      {/* ── Logout ─────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Изход</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },

  // Header
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 24,
  },

  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e67e22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  identity: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  driverPhone: {
    fontSize: 14,
    color: '#555',
  },

  // Info cards (rating + status)
  infoCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoCardGreen: {
    backgroundColor: '#e6f4ea',
  },
  infoCardOrange: {
    backgroundColor: '#fff3e0',
  },
  infoCardLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  infoCardValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
  },

  // Section card
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  editLink: {
    fontSize: 14,
    color: '#e67e22',
    fontWeight: '600',
  },

  // View mode
  fieldValue: {
    fontSize: 16,
    color: '#222',
    marginBottom: 4,
  },
  plateValue: {
    fontSize: 15,
    color: '#555',
    letterSpacing: 1,
  },

  // Edit mode
  fieldLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#fafafa',
    marginBottom: 4,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btnSave: {
    flex: 1,
    backgroundColor: '#e67e22',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnCancelText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 15,
  },

  // Logout
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e74c3c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#e74c3c',
    fontWeight: '700',
    fontSize: 16,
  },
});
