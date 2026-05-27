import { apiClient } from './api.client';

export interface ReverseGeocodeResult {
  lat: number;
  lng: number;
  display_name: string;
}

export const mapsApi = {
  /**
   * Reverse geocode a map coordinate to a human-readable address.
   * Calls GET /maps/reverse?lat=&lng= on the CrypGo backend,
   * which proxies the request to Nominatim.
   */
  reverseGeocode: async (lat: number, lng: number): Promise<ReverseGeocodeResult> => {
    const { data } = await apiClient.get<ReverseGeocodeResult>('/maps/reverse', {
      params: { lat, lng },
    });
    return data;
  },
};
