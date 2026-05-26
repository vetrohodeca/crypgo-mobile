import { AxiosResponse } from 'axios';
import { apiClient } from './api.client';
import type {
  Order,
  CreateOrderDto,
  InitiatePaymentDto,
  InitiatePaymentResponse,
  RevealPreimageDto,
} from '../types';

const get  = <T>(url: string)           => apiClient.get<T>(url).then((r: AxiosResponse<T>) => r.data);
const post = <T>(url: string, d?: any)  => apiClient.post<T>(url, d).then((r: AxiosResponse<T>) => r.data);
const patch = <T>(url: string, d?: any) => apiClient.patch<T>(url, d).then((r: AxiosResponse<T>) => r.data);

export const ordersApi = {
  // ── Пътник ──────────────────────────────────────────────────────
  create:          (dto: CreateOrderDto)                           => post<Order>('/orders', dto),
  initiatePayment: (id: string, dto: InitiatePaymentDto)          => post<InitiatePaymentResponse>(`/orders/${id}/payment`, dto),
  complete:        (id: string, dto: RevealPreimageDto)           => patch<Order>(`/orders/${id}/complete`, dto),
  cancelByPassenger: (id: string)                                  => patch<Order>(`/orders/${id}/cancel`),
  myOrders:        ()                                              => get<Order[]>('/orders/my'),
  findOne:         (id: string)                                    => get<Order>(`/orders/${id}`),

  // ── Шофьор ──────────────────────────────────────────────────────
  available:       ()                                              => get<Order[]>('/orders/available'),
  driverOrders:    ()                                              => get<Order[]>('/orders/driver/my'),
  accept:          (id: string)                                    => patch<Order>(`/orders/${id}/accept`),
  start:           (id: string)                                    => patch<Order>(`/orders/${id}/start`),
  cancelByDriver:  (id: string)                                    => patch<Order>(`/orders/${id}/driver-cancel`),
};
