import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authApi } from '@cryptgo/shared';
import { useAuthStore } from '@/store/useAuthStore';
import type { AuthNavProp } from '@/navigation/types';

export default function LoginScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const setTokens  = useAuthStore((s) => s.setTokens);

  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Грешка', 'Моля въведете телефон и парола.');
      return;
    }
    setLoading(true);
    try {
      const resp = await authApi.login({ phone: phone.trim(), password });
      setTokens(resp.access_token, resp.refresh_token, resp.user);
    } catch (err: any) {
      Alert.alert('Грешка при вход', err?.response?.data?.message ?? 'Невалидни данни');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>₿ CrypGo</Text>
      <Text style={styles.subtitle}>Плащай с Lightning</Text>

      <TextInput
        style={styles.input}
        placeholder="Телефон (напр. +359888123456)"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder="Парола"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Вход</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Нямате акаунт? Регистрация →</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: '#fff',
  },
  logo:     { fontSize: 40, fontWeight: 'bold', color: '#F7931A', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 36 },
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
