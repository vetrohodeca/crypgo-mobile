// Drivers

export type DriverStatus = 'OFFLINE' | 'AVAILABLE' | 'BUSY';

export interface Driver {
  id: string;
  phone: string;
  name: string;
  ln_node_id: string | null;
  car_model: string;
  license_plate: string;
  is_approved: boolean;
  status: DriverStatus;
  rating: number | null;
  created_at: string;
}

export interface RegisterDriverDto {
  phone: string;
  name: string;
  password: string;
  ln_node_id: string;
  car_model: string;
  license_plate: string;
}

export interface UpdateDriverStatusDto {
  status: DriverStatus;
}

export interface UpdateDriverCarDto {
  car_model: string;
  license_plate: string;
}

// Result from GEORADIUS (GET /location/nearest-driver)
export interface NearestDriverResult {
  driverId: string;
  distanceKm: number;
  lat: number;
  lng: number;
}
