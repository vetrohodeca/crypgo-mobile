import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp }    from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login:    undefined;
  Register: undefined;
};

export type AppTabParamList = {
  Home:     undefined;   // Статус + карта
  Orders:   undefined;   // Налични поръчки (HELD)
  Earnings: undefined;   // История
};

export type AppStackParamList = {
  Tabs:        undefined;
  OrderDetail: { orderId: string };   // Детайл преди приемане
  ActiveRide:  { orderId: string };   // Активен курс
};

export type AuthNavProp  = NativeStackNavigationProp<AuthStackParamList>;
export type AppNavProp   = NativeStackNavigationProp<AppStackParamList>;
export type TabNavProp   = BottomTabNavigationProp<AppTabParamList>;
