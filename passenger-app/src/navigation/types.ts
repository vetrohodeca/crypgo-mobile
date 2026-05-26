import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp }    from '@react-navigation/bottom-tabs';

// ── Auth Stack ────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login:    undefined;
  Register: undefined;
};

// ── App Tabs ──────────────────────────────────────────────────────

export type AppTabParamList = {
  Home:     undefined;  // Карта + заявка на курс
  History:  undefined;  // История на поръчки
};

// ── App Stack (вложен в Tab) ──────────────────────────────────────

export type AppStackParamList = {
  Tabs:       undefined;
  RequestRide: undefined;   // Избор на дестинация
  Payment:    { orderId: string };  // Invoice + плащане
  Tracking:   { orderId: string };  // Real-time проследяване
};

// ── Navigation prop shortcuts ─────────────────────────────────────

export type AuthNavProp  = NativeStackNavigationProp<AuthStackParamList>;
export type AppNavProp   = NativeStackNavigationProp<AppStackParamList>;
export type TabNavProp   = BottomTabNavigationProp<AppTabParamList>;
