import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://10.0.2.2:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from store on every request
api.interceptors.request.use((config) => {
  const { getState } = require('../store/useAuthStore');
  const token: string | null = getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
