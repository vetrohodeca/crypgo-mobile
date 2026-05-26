/**
 * useAuthStore — JWT токени + потребителска информация.
 *
 * Токените се пазят в паметта (за MVP).
 * В production: AsyncStorage / expo-secure-store.
 */
import { create } from 'zustand';
import { configureApiClient } from '@cryptgo/shared';

interface AuthUser {
  id: string;
  phone: string;
  name: string;
  role: 'passenger' | 'driver';
}

interface AuthState {
  user:         AuthUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  isLoggedIn:   boolean;

  setTokens: (access: string, refresh: string, user: AuthUser) => void;
  logout:    () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Конфигурираме Axios клиента с callback-и към store-а
  configureApiClient({
    getAccessToken:  () => get().accessToken,
    getRefreshToken: () => get().refreshToken,
    setTokens: (access, refresh) =>
      set((s) => ({ accessToken: access, refreshToken: refresh })),
    onLogout: () => set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false }),
  });

  return {
    user:         null,
    accessToken:  null,
    refreshToken: null,
    isLoggedIn:   false,

    setTokens: (access, refresh, user) =>
      set({ accessToken: access, refreshToken: refresh, user, isLoggedIn: true }),

    logout: () =>
      set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false }),
  };
});
