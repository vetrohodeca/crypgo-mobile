import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authApi } from '@cryptgo/shared';
import { useAuthStore } from '@/store/useAuthStore';
import type { AuthNavProp } from '@/navigation/types';

export default function RegisterScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const setTokens  = useAuthStore((s) => s.setTokens);

  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !phone.trim() || !password) {
      Alert.alert('Грешка', 'Всички полета са задължителни.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Грешка', 'Паролите не съвпадат.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Грешка', 'Паролата трябва да е поне 8 символа.');
      return;
    }

    setLoading(true);
    try {
      // ln_node_id се генерира от Breez SDK на устройството
      // В DEV_MODE: оставяме го undefined — backend го приема като optional
      const resp = await authApi.registerPassenger({
        name: name.trim(),
        phone: phone.trim(),
        password,
      });
      setTokens(resp.access_token, resp.refresh_token, resp.user);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      Alert.alert('Грешка при регистрация', Array.isArray(msg) ? msg.join('\n') : msg ?? 'Опитайте отново.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>₿ CrypGo</Text>
        <Text style={styles.title}>Регистрация като пътник</Text>

        <TextInput
          style={styles.input} placeholder="Имена (напр. Иван Иванов)"
          value={name} onChangeText={setName}
        />
        <TextInput
          style={styles.input} placeholder="Телефон (+359888123456)"
          keyboardType="phone-pad" autoComplete="tel"
          value={phone} onChangeText={setPhone}
        />
        <TextInput
          style={styles.input} placeholder="Парола (мин. 8 символа)"
          secureTextEntry value={password} onChangeText={setPassword}
        />
        <TextInput
          style={styles.input} placeholder="Потвърди парола"
          secureTextEntry value={confirm} onChangeText={setConfirm}
        />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Създай акаунт</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>← Обратно към вход</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: '#fff',
  },
  logo:   { fontSize: 36, fontWeight: 'bold', color: '#F7931A', marginBottom: 4 },
  title:  { fontSize: 18, color: '#333', marginBottom: 28 },
  input: {
    width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, marginBottom: 12, fontSize: 16,
  },
  btn: {
    width: '100%', backgroundColor: '#F7931A', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:    { color: '#F7931A', marginTop: 20, fontSize: 14 },
});
