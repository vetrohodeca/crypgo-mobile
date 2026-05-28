import React, { useState, useMemo } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authApi }       from '@crypgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { initDriverSocket } from '@/services/backgroundLocation.service';
import type { AuthNavProp } from '@/navigation/types';

const PHONE_RE = /^(\+?[1-9]\d{6,18}|0\d{9})$/;

function validate(phone: string, password: string) {
  return {
    phone:    !PHONE_RE.test(phone.trim())  ? 'Невалиден телефонен номер' : '',
    password: password.length < 8           ? 'Паролата трябва да е поне 8 символа' : '',
  };
}

export default function LoginScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const setTokens  = useAuthStore((s) => s.setTokens);

  const [phone,        setPhone]        = useState('');
  const [password,     setPassword]     = useState('');
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [touchedPass,  setTouchedPass]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [serverError,  setServerError]  = useState('');

  const errors    = useMemo(() => validate(phone, password), [phone, password]);
  const canSubmit = !errors.phone && !errors.password;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setServerError('');
    setLoading(true);
    try {
      // Pass role:'driver' so the backend searches the drivers table first.
      // This lets a phone registered as both passenger and driver log in here.
      const resp = await authApi.login({ phone: phone.trim(), password, role: 'driver' });
      setTokens(resp.access_token, resp.refresh_token, resp.user);
      initDriverSocket(resp.access_token);
    } catch (err: any) {
      setServerError(err?.response?.data?.message ?? 'Невалидни данни. Опитайте отново.');
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
        style={[styles.input, touchedPhone && errors.phone ? styles.inputError : null]}
        placeholder="Телефон (+359888123456 или 0888123456)"
        keyboardType="phone-pad"
        autoCorrect={false}
        value={phone}
        onChangeText={(v) => { setPhone(v); setTouchedPhone(true); setServerError(''); }}
        onBlur={() => setTouchedPhone(true)}
      />
      {touchedPhone && errors.phone ? (
        <Text style={styles.fieldError}>{errors.phone}</Text>
      ) : null}

      <TextInput
        style={[styles.input, touchedPass && errors.password ? styles.inputError : null]}
        placeholder="Парола"
        secureTextEntry
        autoCorrect={false}
        autoCapitalize="none"
        value={password}
        onChangeText={(v) => { setPassword(v); setTouchedPass(true); setServerError(''); }}
        onBlur={() => setTouchedPass(true)}
      />
      {touchedPass && errors.password ? (
        <Text style={styles.fieldError}>{errors.password}</Text>
      ) : null}

      {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

      <TouchableOpacity
        style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
        onPress={handleLogin}
        disabled={!canSubmit || loading}
      >
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
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: '#fff',
  },
  logo:     { fontSize: 40, fontWeight: 'bold', color: NAVY, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 36 },

  input: {
    width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 14, marginBottom: 4, fontSize: 16,
  },
  inputError:  { borderColor: '#e74c3c' },
  fieldError:  { width: '100%', color: '#e74c3c', fontSize: 12, marginBottom: 8, paddingLeft: 4 },
  serverError: { color: '#e74c3c', fontSize: 13, textAlign: 'center', marginBottom: 8 },

  btn: {
    width: '100%', backgroundColor: NAVY, borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#8a8aa0' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:    { color: NAVY, marginTop: 20, fontSize: 14 },
});
