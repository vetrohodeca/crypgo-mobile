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
  setTokens:  (access: string, refresh: string, user: AuthUser) => void;
  /** Merge profile changes (e.g. after PATCH /drivers/me/car) into the store. */
  updateUser: (partial: Partial<AuthUser>) => void;
  logout:     () => void;
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
    updateUser: (partial) =>
      set((s) => (s.user ? { user: { ...s.user, ...partial } } : s)),
    logout: () =>
      set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false }),
  };
});
