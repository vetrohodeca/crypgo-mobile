import React, { useState, useMemo } from 'react';
import {
  Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authApi } from '@cryptgo/shared';
import { useAuthStore } from '@/store/useAuthStore';
import type { AuthNavProp } from '@/navigation/types';

const PHONE_RE = /^(\+?[1-9]\d{6,18}|0\d{9})$/;

function validate(name: string, phone: string, password: string, confirm: string) {
  return {
    name:     name.trim().length < 2         ? 'Имената трябва да са поне 2 символа' : '',
    phone:    !PHONE_RE.test(phone.trim())   ? 'Невалиден телефонен номер' : '',
    password: password.length < 8            ? 'Паролата трябва да е поне 8 символа' : '',
    confirm:  confirm !== password            ? 'Паролите не съвпадат' : '',
  };
}

type Field = 'name' | 'phone' | 'password' | 'confirm';

export default function RegisterScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const setTokens  = useAuthStore((s) => s.setTokens);

  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [touched,  setTouched]  = useState<Partial<Record<Field, boolean>>>({});
  const [loading,  setLoading]  = useState(false);
  const [serverError, setServerError] = useState('');

  const errors   = useMemo(() => validate(name, phone, password, confirm), [name, phone, password, confirm]);
  const canSubmit = !errors.name && !errors.phone && !errors.password && !errors.confirm;

  const touch = (field: Field) => setTouched((t) => ({ ...t, [field]: true }));

  const handleRegister = async () => {
    if (!canSubmit) return;
    setServerError('');
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
      setServerError(Array.isArray(msg) ? msg.join('\n') : msg ?? 'Опитайте отново.');
    } finally {
      setLoading(false);
    }
  };

  const Field = (
    field: Field,
    placeholder: string,
    value: string,
    onChange: (v: string) => void,
    opts: object = {},
  ) => (
    <>
      <TextInput
        style={[styles.input, touched[field] && errors[field] ? styles.inputError : null]}
        placeholder={placeholder}
        autoCorrect={false}
        autoComplete="off"
        value={value}
        onChangeText={(v) => { onChange(v); touch(field); setServerError(''); }}
        onBlur={() => touch(field)}
        {...opts}
      />
      {touched[field] && errors[field] ? (
        <Text style={styles.fieldError}>{errors[field]}</Text>
      ) : null}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>₿ CrypGo</Text>
        <Text style={styles.title}>Регистрация като пътник</Text>

        {Field('name',     'Имена (напр. Иван Иванов)',          name,     setName,     { autoCapitalize: 'words' })}
        {Field('phone',    'Телефон (+359888123456 или 0888...)', phone,    setPhone,    { keyboardType: 'phone-pad', autoComplete: 'tel', autoCorrect: false })}
        {Field('password', 'Парола (мин. 8 символа)',            password, setPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
        {Field('confirm',  'Потвърди парола',                    confirm,  setConfirm,  { secureTextEntry: true, autoCapitalize: 'none' })}

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={!canSubmit || loading}
        >
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
    padding: 14, marginBottom: 4, fontSize: 16,
  },
  inputError: { borderColor: '#e74c3c' },
  fieldError: { width: '100%', color: '#e74c3c', fontSize: 12, marginBottom: 8, paddingLeft: 4 },
  serverError: { color: '#e74c3c', fontSize: 13, textAlign: 'center', marginBottom: 8 },

  btn: {
    width: '100%', backgroundColor: '#F7931A', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#f0c070' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:    { color: '#F7931A', marginTop: 20, fontSize: 14 },
});
