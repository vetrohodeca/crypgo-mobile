// Statuses

export type OrderStatus =
  | 'CREATED'
  | 'HELD'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED';

export type TransactionStatus = 'PENDING' | 'HELD' | 'SETTLED' | 'CANCELED';

// Transaction (escrow)

export interface Transaction {
  id: string;
  amount_satoshis: string; // BigInt serialised as string
  payment_hash: string;
  boltz_swap_id: string | null;
  status: TransactionStatus;
}

// Order

export interface Order {
  id: string;
  passenger_id: string;
  driver_id: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_meters: number;
  duration_seconds: number;
  price_eur: string; // Decimal serialised as string
  status: OrderStatus;
  /** ISO timestamp when the driver requested cancel during IN_PROGRESS; null otherwise. */
  cancel_requested_at: string | null;
  created_at: string;
  updated_at: string;
  transaction: Transaction | null;
}

// DTOs

export interface CreateOrderDto {
  pickup_address: string;
  dropoff_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
}

export interface InitiatePaymentDto {
  payment_hash: string; // SHA256(preimage) — 64 hex characters
}

export interface RevealPreimageDto {
  preimage: string; // 64 hex characters — stored only on the passenger's device
}

// Response from initiatePayment — contains BOLT11 invoice
export interface InitiatePaymentResponse extends Order {
  invoice: string;      // BOLT11 invoice for payment via Breez SDK
  swapId: string;       // Boltz swap ID
  amountSats: number;   // Amount in satoshis
}
