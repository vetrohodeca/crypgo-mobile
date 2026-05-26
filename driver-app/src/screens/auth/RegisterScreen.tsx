import React, { useState } from 'react';
import {
  ScrollView, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authApi }       from '@cryptgo/shared';
import { useAuthStore }  from '@/store/useAuthStore';
import { initDriverSocket } from '@/services/backgroundLocation.service';
import type { AuthNavProp } from '@/navigation/types';

export default function RegisterScreen() {
  const navigation = useNavigation<AuthNavProp>();
  const setTokens  = useAuthStore((s) => s.setTokens);

  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [pass,    setPass]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [car,     setCar]     = useState('');
  const [plate,   setPlate]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !phone || !pass || !car || !plate) {
      Alert.alert('Грешка', 'Всички полета са задължителни.'); return;
    }
    if (pass !== confirm) {
      Alert.alert('Грешка', 'Паролите не съвпадат.'); return;
    }

    setLoading(true);
    try {
      // ln_node_id → генерира се от Breez SDK (DEV: placeholder)
      const dummyNodeId = '02' + Array(64).fill('0').join('');
      const resp = await authApi.registerDriver({
        name: name.trim(),
        phone: phone.trim(),
        password: pass,
        ln_node_id: dummyNodeId,
        car_model: car.trim(),
        license_plate: plate.trim().toUpperCase(),
      });
      setTokens(resp.access_token, resp.refresh_token, resp.user);
      initDriverSocket(resp.access_token);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      Alert.alert('Грешка', Array.isArray(msg) ? msg.join('\n') : msg ?? 'Опитайте отново.');
    } finally {
      setLoading(false);
    }
  };

  const F = (label: string, value: string, onChange: (v: string) => void, opts: object = {}) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} {...opts} />
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>🚕 CrypGo Driver</Text>
        <Text style={styles.title}>Регистрация</Text>

        {F('Имена', name, setName)}
        {F('Телефон', phone, setPhone, { keyboardType: 'phone-pad' })}
        {F('Парола (мин. 8)', pass, setPass, { secureTextEntry: true })}
        {F('Потвърди парола', confirm, setConfirm, { secureTextEntry: true })}
        {F('Марка и модел кола', car, setCar, { placeholder: 'напр. Toyota Corolla 2020' })}
        {F('Регистрационен номер', plate, setPlate, { placeholder: 'напр. СА1234АВ', autoCapitalize: 'characters' })}

        <Text style={styles.note}>
          ℹ️ Акаунтът изисква одобрение от администратор преди да можете да приемате поръчки.
        </Text>

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Създай акаунт</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>← Обратно към вход</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const NAVY = '#1a1a2e';
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  logo:  { fontSize: 32, fontWeight: 'bold', color: NAVY, textAlign: 'center', marginTop: 16 },
  title: { fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 20 },
  label: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 15 },
  note:  { fontSize: 13, color: '#888', textAlign: 'center', marginVertical: 16, lineHeight: 20 },
  btn:   { backgroundColor: NAVY, borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:    { color: NAVY, textAlign: 'center', marginTop: 16, fontSize: 14 },
});
