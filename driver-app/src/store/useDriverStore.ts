/**
 * useDriverStore — driver status + active order.
 *
 * status: OFFLINE | AVAILABLE | BUSY
 *   - OFFLINE     -> cannot see orders, GPS stream stopped
 *   - AVAILABLE   -> sees available orders, GPS stream active
 *   - BUSY        -> executing a ride, GPS stream active
 *
 * activeOrderId: the currently accepted order (null = none)
 */
import { create } from 'zustand';
import type { DriverStatus, Order } from '@cryptgo/shared';
import { apiClient } from '@cryptgo/shared';

interface DriverState {
  status:        DriverStatus;
  activeOrder:   Order | null;
  isGpsTracking: boolean;

  setStatus:      (s: DriverStatus) => Promise<void>;
  setActiveOrder: (o: Order | null) => void;
  setGpsTracking: (v: boolean) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  status:        'OFFLINE',
  activeOrder:   null,
  isGpsTracking: false,

  /** Changes the status and sends it to the backend */
  setStatus: async (status) => {
    try {
      await apiClient.patch('/drivers/me/status', { status });
    } catch {
      // Silent — will sync on the next request
    }
    set({ status });
  },

  setActiveOrder: (activeOrder) => set({ activeOrder }),
  setGpsTracking: (isGpsTracking) => set({ isGpsTracking }),
}));
