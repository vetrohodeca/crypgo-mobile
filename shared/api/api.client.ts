/**
 * Axios client for the CrypGo backend.
 *
 * Features:
 * - Base URL from a constant (easy to switch for dev/prod)
 * - Automatic Authorization: Bearer <token> attachment
 * - Automatic access token refresh on 401
 * - Single retry after a successful refresh
 */
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

// This value is overridden by the configuration of the specific application
export const API_BASE_URL = 'http://10.0.2.2:3000'; // Android emulator → localhost

// Callbacks for token storage (injected by the application)

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

// Axios instance

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attaches JWT

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

// Response interceptor: refresh on 401

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

    // Auth endpoints (login / register / refresh) → never attempt a token refresh.
    // A 401 from /auth/login means wrong credentials, not an expired token.
    const url = originalRequest.url ?? '';
    const isAuthEndpoint = url.includes('/auth/');

    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    // If already refreshing — wait in the queue
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
