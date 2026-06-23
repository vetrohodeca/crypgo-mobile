// Users (passengers)

export interface User {
  id: string;
  phone: string;
  name: string;
  ln_node_id: string | null;
  rating: number | null;
  created_at: string;
}

// Auth DTOs

export interface UpdateUserNameDto {
  name: string;
}

export interface UpdateLnNodeDto {
  ln_node_id: string;
}

export interface RegisterPassengerDto {
  phone: string;
  name: string;
  password: string;
  ln_node_id?: string;
}

export interface LoginDto {
  phone: string;
  password: string;
  /** Pass 'driver' from the driver app so phones registered as both roles log in as driver. */
  role?: 'passenger' | 'driver';
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
