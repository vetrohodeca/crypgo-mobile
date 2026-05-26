/**
 * useOrderStore — активна поръчка + invoice данни.
 *
 * Съдържа данните за текущия курс:
 *   - currentOrder: Order | null
 *   - pendingInvoice: BOLT11 + preimage (само на устройството!)
 */
import { create } from 'zustand';
import type { Order, InitiatePaymentResponse } from '@cryptgo/shared';

interface PendingInvoice {
  bolt11:      string;   // BOLT11 invoice за плащане
  swapId:      string;   // Boltz swap ID
  amountSats:  number;
  preimage:    string;   // КРИТИЧНО: пази се само тук, никога не се логва
  paymentHash: string;
}

interface OrderState {
  currentOrder:   Order | null;
  pendingInvoice: PendingInvoice | null;

  setCurrentOrder:   (order: Order | null) => void;
  setPendingInvoice: (inv: PendingInvoice | null) => void;

  /** Задава поръчка и invoice след initiatePayment */
  setPaymentInitiated: (
    resp: InitiatePaymentResponse,
    preimage: string,
    paymentHash: string,
  ) => void;

  /** Изчиства след завършване или анулиране */
  clear: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  currentOrder:   null,
  pendingInvoice: null,

  setCurrentOrder:   (order) => set({ currentOrder: order }),
  setPendingInvoice: (inv)   => set({ pendingInvoice: inv }),

  setPaymentInitiated: (resp, preimage, paymentHash) =>
    set({
      currentOrder: resp,
      pendingInvoice: {
        bolt11:      resp.invoice,
        swapId:      resp.swapId,
        amountSats:  resp.amountSats,
        preimage,    // НИКОГА не изпращай към сървъра преди COMPLETED!
        paymentHash,
      },
    }),

  clear: () => set({ currentOrder: null, pendingInvoice: null }),
}));
