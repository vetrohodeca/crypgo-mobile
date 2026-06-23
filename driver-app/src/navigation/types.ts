import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp }    from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login:    undefined;
  Register: undefined;
};

export type AppTabParamList = {
  Home:     undefined;   // Status + map
  Orders:   undefined;   // Available orders (HELD)
  Earnings: undefined;   // History
  Profile:  undefined;   // Driver profile + car update
};

export type AppStackParamList = {
  Tabs:        undefined;
  OrderDetail: { orderId: string; readOnly?: boolean };   // Order detail before accepting / history
  ActiveRide:  { orderId: string };                       // Active ride
  Feedback:    undefined;                                 // Feedback form
};

export type AuthNavProp  = NativeStackNavigationProp<AuthStackParamList>;
export type AppNavProp   = NativeStackNavigationProp<AppStackParamList>;
export type TabNavProp   = BottomTabNavigationProp<AppTabParamList>;
