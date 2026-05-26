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
  configureApiClient({
    getAccessToken:  () => get().accessToken,
    getRefreshToken: () => get().refreshToken,
    setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
    onLogout: () => set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false }),
  });

  return {
    user: null, accessToken: null, refreshToken: null, isLoggedIn: false,
    setTokens: (access, refresh, user) =>
      set({ accessToken: access, refreshToken: refresh, user, isLoggedIn: true }),
    logout: () =>
      set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false }),
  };
});
