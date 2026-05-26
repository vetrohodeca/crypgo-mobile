import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authApi }       from '@cryptgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { initDriverSocket } from '@/services/backgroundLocation.service';
import type { AuthNavProp } from '@/navigation/types';

export default function LoginScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const setTokens  = useAuthStore((s) => s.setTokens);

  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password) {
      Alert.alert('Грешка', 'Въведете телефон и парола.');
      return;
    }
    setLoading(true);
    try {
      const resp = await authApi.login({ phone: phone.trim(), password });
      if (resp.user.role !== 'driver') {
        Alert.alert('Грешка', 'Това приложение е само за шофьори.');
        return;
      }
      setTokens(resp.access_token, resp.refresh_token, resp.user);
      initDriverSocket(resp.access_token);
    } catch (err: any) {
      Alert.alert('Грешка', err?.response?.data?.message ?? 'Невалидни данни');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>🚕 CrypGo</Text>
      <Text style={styles.subtitle}>Портал за шофьори</Text>

      <TextInput
        style={styles.input} placeholder="Телефон (+359...)"
        keyboardType="phone-pad" value={phone} onChangeText={setPhone}
      />
      <TextInput
        style={styles.input} placeholder="Парола"
        secureTextEntry value={password} onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Вход</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Нямате акаунт? Регистрация →</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const NAVY = '#1a1a2e';
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  logo:     { fontSize: 40, fontWeight: 'bold', color: NAVY, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 36 },
  input: {
    width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, marginBottom: 12, fontSize: 16,
  },
  btn: { width: '100%', backgroundColor: NAVY, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:    { color: NAVY, marginTop: 20, fontSize: 14 },
});
