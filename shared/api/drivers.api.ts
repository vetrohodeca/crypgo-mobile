import { apiClient } from './api.client';
import type { Driver, UpdateDriverCarDto } from '../types';

export const driversApi = {
  /** GET /drivers/me — current driver's profile */
  getProfile: (): Promise<Driver> =>
    apiClient.get<Driver>('/drivers/me').then((r) => r.data),

  /** PATCH /drivers/me/car — update car model and license plate */
  updateCar: (dto: UpdateDriverCarDto): Promise<Driver> =>
    apiClient.patch<Driver>('/drivers/me/car', dto).then((r) => r.data),
};
