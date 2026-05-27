import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp }    from '@react-navigation/bottom-tabs';
import type { RouteProp }                  from '@react-navigation/native';

// Auth Stack

export type AuthStackParamList = {
  Login:    undefined;
  Register: undefined;
};

// App Tabs

export type AppTabParamList = {
  Home:     undefined;  // Map + ride request
  History:  undefined;  // Order history
};

/** Data returned by MapPickerScreen → consumed by RequestRideScreen */
export interface PickedAddress {
  field:   'pickup' | 'dropoff';
  address: string;
  lat:     number;
  lng:     number;
}

// App Stack (nested in Tab)

export type AppStackParamList = {
  Tabs:        undefined;
  /** undefined allows navigation.navigate('RequestRide') with no params */
  RequestRide: undefined | { picked?: PickedAddress };
  /**
   * Map-picker screen — lets the passenger pick an address by dragging the map.
   * `initialCoords` centres the map on mount (defaults to Sofia if omitted).
   */
  MapPicker:   { field: 'pickup' | 'dropoff'; initialCoords?: { lat: number; lng: number } };
  Payment:     { orderId: string };
  Tracking:    { orderId: string };
};

// Navigation prop shortcuts

export type AuthNavProp  = NativeStackNavigationProp<AuthStackParamList>;
export type AppNavProp   = NativeStackNavigationProp<AppStackParamList>;
export type TabNavProp   = BottomTabNavigationProp<AppTabParamList>;

// Route prop shortcuts

export type MapPickerRouteProp   = RouteProp<AppStackParamList, 'MapPicker'>;
export type RequestRideRouteProp = RouteProp<AppStackParamList, 'RequestRide'>;
