/**
 * Axios клиент за CrypGo backend.
 *
 * Функционалности:
 * - Базов URL от константа (лесно сменяем за dev/prod)
 * - Автоматично прикачане на Authorization: Bearer <token>
 * - Автоматичен refresh на access token при 401
 * - Повторен опит след успешен refresh (1 път)
 */
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// Тази стойност се препокрива от конфигурацията на конкретното приложение
export const API_BASE_URL = 'http://10.0.2.2:3000'; // Android emulator → localhost

// ── Callbacks за token storage (инжектирани от приложението) ──────

let _getAccessToken:  () => string | null  = () => null;
let _getRefreshToken: () => string | null  = () => null;
let _setTokens: (access: string, refresh: string) => void = () => {};
let _onLogout: () => void = () => {};

export function configureApiClient(opts: {
  getAccessToken:  () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  onLogout: () => void;
  baseURL?: string;
}) {
  _getAccessToken  = opts.getAccessToken;
  _getRefreshToken = opts.getRefreshToken;
  _setTokens       = opts.setTokens;
  _onLogout        = opts.onLogout;
  if (opts.baseURL) apiClient.defaults.baseURL = opts.baseURL;
}

// ── Axios инстанция ───────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request интерсептор: прикача JWT ──────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = _getAccessToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response интерсептор: refresh при 401 ────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: any) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Ако вече refreshваме — чакаме в опашка
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
          return apiClient(originalRequest);
        })
        .catch(Promise.reject);
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = _getRefreshToken();
    if (!refreshToken) {
      _onLogout();
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${apiClient.defaults.baseURL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefresh } = data;
      _setTokens(access_token, newRefresh);
      processQueue(null, access_token);

      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${access_token}`,
      };
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      _onLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
