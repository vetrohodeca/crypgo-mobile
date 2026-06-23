import { AxiosResponse } from 'axios';
import { apiClient } from './api.client';
import type {
  LoginDto,
  RegisterPassengerDto,
  RegisterDriverDto,
  TokenResponse,
  RefreshTokenDto,
} from '../types';

export const authApi = {
  registerPassenger: (dto: RegisterPassengerDto) =>
    apiClient.post<TokenResponse>('/auth/register/passenger', dto)
      .then((r: AxiosResponse<TokenResponse>) => r.data),

  login: (dto: LoginDto) =>
    apiClient.post<TokenResponse>('/auth/login', dto)
      .then((r: AxiosResponse<TokenResponse>) => r.data),

  refresh: (dto: RefreshTokenDto) =>
    apiClient.post<TokenResponse>('/auth/refresh', dto)
      .then((r: AxiosResponse<TokenResponse>) => r.data),

  registerDriver: (dto: RegisterDriverDto) =>
    apiClient.post<TokenResponse>('/auth/register/driver', dto)
      .then((r: AxiosResponse<TokenResponse>) => r.data),

  logout: () =>
    apiClient.post('/auth/logout').then((r: AxiosResponse) => r.data),
};
