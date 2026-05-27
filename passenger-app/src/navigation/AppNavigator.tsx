import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import type { AppStackParamList, AppTabParamList } from './types';
import HomeScreen         from '@/screens/HomeScreen';
import OrderHistoryScreen from '@/screens/OrderHistoryScreen';
import RequestRideScreen  from '@/screens/RequestRideScreen';
import MapPickerScreen    from '@/screens/MapPickerScreen';
import PaymentScreen      from '@/screens/PaymentScreen';
import TrackingScreen     from '@/screens/TrackingScreen';

const Tab   = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F7931A', // Bitcoin orange
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: '🗺 Карта' }}
      />
      <Tab.Screen
        name="History"
        component={OrderHistoryScreen}
        options={{ tabBarLabel: '📋 История' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"        component={AppTabs} />
      <Stack.Screen
        name="RequestRide"
        component={RequestRideScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="MapPicker"
        component={MapPickerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Payment"  component={PaymentScreen} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
    </Stack.Navigator>
  );
}
