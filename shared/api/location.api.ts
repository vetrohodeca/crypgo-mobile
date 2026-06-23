import { AxiosResponse } from 'axios';
import { apiClient } from './api.client';
import type { NearestDriverResult } from '../types';

export const locationApi = {
  nearestDriver: (lat: number, lng: number, radiusKm = 5) =>
    apiClient
      .get<NearestDriverResult | null>('/location/nearest-driver', {
        params: { lat, lng, radius: radiusKm },
      })
      .then((r: AxiosResponse<NearestDriverResult | null>) => r.data),
};
