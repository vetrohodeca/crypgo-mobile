/**
 * useDriverStore — статус на шофьора + активна поръчка.
 *
 * status: OFFLINE | AVAILABLE | BUSY
 *   - OFFLINE     → не вижда поръчки, GPS стрийм спрян
 *   - AVAILABLE   → вижда налични поръчки, GPS стрийм активен
 *   - BUSY        → изпълнява курс, GPS стрийм активен
 *
 * activeOrderId: текущата приета поръчка (null = няма)
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

  /** Променя статуса и го изпраща към backend-а */
  setStatus: async (status) => {
    try {
      await apiClient.patch('/drivers/me/status', { status });
    } catch {
      // Тихо — ще се sync-не при следващ request
    }
    set({ status });
  },

  setActiveOrder: (activeOrder) => set({ activeOrder }),
  setGpsTracking: (isGpsTracking) => set({ isGpsTracking }),
}));
