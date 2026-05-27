import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp }    from '@react-navigation/bottom-tabs';

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

// App Stack (nested in Tab)

export type AppStackParamList = {
  Tabs:       undefined;
  RequestRide: undefined;   // Destination selection
  Payment:    { orderId: string };  // Invoice + payment
  Tracking:   { orderId: string };  // Real-time tracking
};

// Navigation prop shortcuts

export type AuthNavProp  = NativeStackNavigationProp<AuthStackParamList>;
export type AppNavProp   = NativeStackNavigationProp<AppStackParamList>;
export type TabNavProp   = BottomTabNavigationProp<AppTabParamList>;
