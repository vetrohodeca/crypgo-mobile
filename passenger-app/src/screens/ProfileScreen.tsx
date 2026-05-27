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
import { usersApi } from '@cryptgo/shared';
import type { User } from '@cryptgo/shared';
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
  if (rating == null) return 'Няма още';
  return `⭐ ${rating.toFixed(1)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bg-BG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Shows first 8 + … + last 6 chars of a 66-char pubkey */
function truncatePubkey(key: string | null): string {
  if (!key) return '—';
  return `${key.slice(0, 8)}…${key.slice(-6)}`;
}

const LN_NODE_REGEX = /^[0-9a-fA-F]{66}$/;

// ── Edit sections ─────────────────────────────────────────────────────────────
type EditSection = 'none' | 'name' | 'ln_node';

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const logout     = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [user, setUser]         = useState<User | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editSection, setEditSection] = useState<EditSection>('none');

  // Form fields
  const [nameInput, setNameInput]       = useState('');
  const [lnNodeInput, setLnNodeInput]   = useState('');

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await usersApi.getProfile();
        if (!cancelled) {
          setUser(data);
          setNameInput(data.name ?? '');
          setLnNodeInput(data.ln_node_id ?? '');
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

  // ── Open edit sections ──────────────────────────────────────────────────────
  const startEditName = useCallback(() => {
    setNameInput(user?.name ?? '');
    setEditSection('name');
  }, [user]);

  const startEditLnNode = useCallback(() => {
    setLnNodeInput(user?.ln_node_id ?? '');
    setEditSection('ln_node');
  }, [user]);

  const cancelEdit = useCallback(() => setEditSection('none'), []);

  // ── Save name ───────────────────────────────────────────────────────────────
  const saveName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      Alert.alert('Грешка', 'Името трябва да е поне 2 символа.');
      return;
    }
    if (trimmed.length > 50) {
      Alert.alert('Грешка', 'Името не може да е по-дълго от 50 символа.');
      return;
    }

    setSaving(true);
    try {
      const updated = await usersApi.updateName({ name: trimmed });
      setUser(updated);
      // Sync auth store so any other screen that reads useAuthStore.user.name
      // reflects the change immediately (no logout/login needed).
      updateUser({ name: updated.name });
      setEditSection('none');
    } catch {
      Alert.alert('Грешка', 'Не можа да се запази името. Опитайте отново.');
    } finally {
      setSaving(false);
    }
  }, [nameInput, updateUser]);

  // ── Save Lightning Node ID ──────────────────────────────────────────────────
  const saveLnNode = useCallback(async () => {
    const trimmed = lnNodeInput.trim().toLowerCase();
    if (!LN_NODE_REGEX.test(trimmed)) {
      Alert.alert('Грешка', 'Lightning Node ID трябва да е точно 66 hex символа.');
      return;
    }

    setSaving(true);
    try {
      const updated = await usersApi.updateLnNode({ ln_node_id: trimmed });
      setUser(updated);
      setEditSection('none');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        Alert.alert('Заето', 'Този Lightning node вече е свързан с друг акаунт.');
      } else {
        Alert.alert('Грешка', 'Не можа да се запази Lightning Node ID. Опитайте отново.');
      }
    } finally {
      setSaving(false);
    }
  }, [lnNodeInput]);

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
        <ActivityIndicator size="large" color="#F7931A" />
      </View>
    );
  }

  if (!user) {
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
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user.name)}</Text>
          </View>
          <View style={styles.identity}>
            {editSection === 'name' ? (
              /* ── Name edit ─────────────────────────────────── */
              <>
                <TextInput
                  style={styles.inlineInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Вашето имe"
                  placeholderTextColor="#aaa"
                  maxLength={50}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                />
                <View style={styles.inlineButtons}>
                  <TouchableOpacity
                    style={[styles.btnSmallSave, saving && styles.btnDisabled]}
                    onPress={saveName}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.btnSmallSaveText}>Запази</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSmallCancel} onPress={cancelEdit} disabled={saving}>
                    <Text style={styles.btnSmallCancelText}>Отказ</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* ── Name view ─────────────────────────────────── */
              <>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <TouchableOpacity onPress={startEditName}>
                    <Text style={styles.editLink}>✏️</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.userPhone}>{user.phone}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── Rating + Member since ──────────────────────────────────── */}
      <View style={styles.infoCardRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardLabel}>Рейтинг</Text>
          <Text style={styles.infoCardValue}>{formatRating(user.rating)}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoCardLabel}>Член от</Text>
          <Text style={styles.infoCardValue}>{formatDate(user.created_at)}</Text>
        </View>
      </View>

      {/* ── Lightning Node ID ──────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⚡ Lightning Node</Text>
          {editSection !== 'ln_node' && (
            <TouchableOpacity onPress={startEditLnNode}>
              <Text style={styles.editLink}>
                {user.ln_node_id ? 'Промени' : 'Добави'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {editSection === 'ln_node' ? (
          /* ── LN edit ─────────────────────────────────────────── */
          <>
            <Text style={styles.fieldLabel}>Node Public Key (66 hex символа)</Text>
            <TextInput
              style={styles.input}
              value={lnNodeInput}
              onChangeText={setLnNodeInput}
              placeholder="02a1b2c3…"
              placeholderTextColor="#aaa"
              maxLength={66}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={saveLnNode}
            />
            <Text style={styles.fieldHint}>
              Попълва се автоматично от Breez SDK. Обновете само при преинсталиране.
            </Text>
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.btnSave, saving && styles.btnDisabled]}
                onPress={saveLnNode}
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
          /* ── LN view ─────────────────────────────────────────── */
          user.ln_node_id ? (
            <Text style={styles.pubkeyValue}>{truncatePubkey(user.ln_node_id)}</Text>
          ) : (
            <Text style={styles.emptyValue}>Не е свързан Lightning портфейл</Text>
          )
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

const ORANGE = '#F7931A';

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
    marginBottom: 20,
  },

  // Card wrapper (avatar section)
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ORANGE,
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

  // Name row (view mode)
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    flexShrink: 1,
  },
  userPhone: {
    fontSize: 14,
    color: '#555',
  },

  // Inline name edit (inside avatarRow)
  inlineInput: {
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#fff',
    marginBottom: 6,
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnSmallSave: {
    backgroundColor: ORANGE,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  btnSmallSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  btnSmallCancel: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 70,
    alignItems: 'center',
  },
  btnSmallCancelText: {
    color: '#555',
    fontWeight: '600',
    fontSize: 13,
  },

  // Info cards (rating + member since)
  infoCardRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoCardLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  editLink: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '600',
  },

  // LN view mode
  pubkeyValue: {
    fontSize: 15,
    color: '#222',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  emptyValue: {
    fontSize: 14,
    color: '#aaa',
    fontStyle: 'italic',
  },

  // LN edit mode
  fieldLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fafafa',
    fontFamily: 'monospace',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btnSave: {
    flex: 1,
    backgroundColor: ORANGE,
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
