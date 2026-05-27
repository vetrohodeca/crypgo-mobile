/**
 * useOrderStore — active order + invoice data.
 *
 * Holds data for the current ride:
 *   - currentOrder: Order | null
 *   - pendingInvoice: BOLT11 + preimage (on the device only!)
 */
import { create } from 'zustand';
import type { Order, InitiatePaymentResponse } from '@cryptgo/shared';

interface PendingInvoice {
  bolt11:      string;   // BOLT11 invoice for payment
  swapId:      string;   // Boltz swap ID
  amountSats:  number;
  preimage:    string;   // CRITICAL: stored here only, never logged
  paymentHash: string;
}

interface OrderState {
  currentOrder:   Order | null;
  pendingInvoice: PendingInvoice | null;

  setCurrentOrder:   (order: Order | null) => void;
  setPendingInvoice: (inv: PendingInvoice | null) => void;

  /** Sets order and invoice after initiatePayment */
  setPaymentInitiated: (
    resp: InitiatePaymentResponse,
    preimage: string,
    paymentHash: string,
  ) => void;

  /** Clears after completion or cancellation */
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
        preimage,    // NEVER send to the server before COMPLETED!
        paymentHash,
      },
    }),

  clear: () => set({ currentOrder: null, pendingInvoice: null }),
}));
