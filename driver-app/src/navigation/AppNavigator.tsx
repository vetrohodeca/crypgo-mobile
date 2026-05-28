import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import type { AppStackParamList, AppTabParamList } from './types';
import HomeScreen           from '@/screens/HomeScreen';
import AvailableOrdersScreen from '@/screens/AvailableOrdersScreen';
import EarningsScreen       from '@/screens/EarningsScreen';
import ProfileScreen        from '@/screens/ProfileScreen';
import OrderDetailScreen    from '@/screens/OrderDetailScreen';
import ActiveRideScreen     from '@/screens/ActiveRideScreen';
import FeedbackScreen       from '@/screens/FeedbackScreen';

const Tab   = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1a1a2e',
      }}
    >
      <Tab.Screen name="Home"     component={HomeScreen}            options={{ tabBarLabel: '🗺 Карта' }} />
      <Tab.Screen name="Orders"   component={AvailableOrdersScreen} options={{ tabBarLabel: '📋 Поръчки' }} />
      <Tab.Screen name="Earnings" component={EarningsScreen}        options={{ tabBarLabel: '₿ Приходи' }} />
      <Tab.Screen name="Profile"  component={ProfileScreen}         options={{ tabBarLabel: '👤 Профил' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"        component={AppTabs} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen}
        options={{ presentation: 'modal' }} />
      <Stack.Screen name="ActiveRide"  component={ActiveRideScreen} />
      <Stack.Screen name="Feedback"    component={FeedbackScreen} />
    </Stack.Navigator>
  );
}
