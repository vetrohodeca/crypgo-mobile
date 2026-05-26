// ── Потребители (пътници) ─────────────────────────────────────────

export interface User {
  id: string;
  phone: string;
  name: string;
  ln_node_id?: string | null;
  created_at: string;
}

// ── Auth DTOs ─────────────────────────────────────────────────────

export interface RegisterPassengerDto {
  phone: string;
  name: string;
  password: string;
  ln_node_id?: string;
}

export interface LoginDto {
  phone: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    phone: string;
    name: string;
    role: 'passenger' | 'driver';
  };
}

export interface RefreshTokenDto {
  refresh_token: string;
}
