import 'react-native-screens';
import React, { useEffect, useRef } from 'react';
import { LogBox, Platform } from 'react-native';
import Constants from 'expo-constants';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import { StatusBar }            from 'expo-status-bar';
import { useAuthStore }         from './src/store/useAuthStore';
import AuthNavigator            from './src/navigation/AuthNavigator';
import AppNavigator             from './src/navigation/AppNavigator';
import { registerForPushNotifications } from './src/services/pushService';
import { notificationsApi }     from '@crypgo/shared';
import type { AppStackParamList } from './src/navigation/types';

// Expo Go (storeClient) removed remote push in SDK 53. A static
// `import * as Notifications from 'expo-notifications'` would initialise the
// module at load time and throw. Guard with a runtime require() instead.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

// ── Suppress known Expo Go / RN 0.76 framework warnings ───────────────────
LogBox.ignoreLogs([
  'createAnimatedNode: Animated node',
  'Background location is limited in Expo Go',
]);

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const pushTokenRef = useRef<string | null>(null);
  const navRef = useRef<NavigationContainerRef<AppStackParamList>>(null);

  // ── Register push token on login ──────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      // On logout: unregister the token
      if (pushTokenRef.current) {
        notificationsApi
          .removeToken(pushTokenRef.current)
          .catch(() => undefined);
        pushTokenRef.current = null;
      }
      return;
    }

    // On login: get the Expo push token and register with the backend
    registerForPushNotifications().then((token) => {
      if (!token) return;
      pushTokenRef.current = token;
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      notificationsApi
        .registerToken(token, platform)
        .catch(() => undefined);
    });
  }, [isLoggedIn]);

  // ── Tap handler: navigate to the relevant screen ──────────────
  useEffect(() => {
    if (IS_EXPO_GO) return; // expo-notifications is unavailable in Expo Go
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          type?: string;
          orderId?: string;
        };
        if (!data?.orderId || !navRef.current) return;

        if (data.type === 'new-order') {
          // New order available → navigate to Orders tab
          navRef.current.navigate('Tabs');
        } else {
          // Active ride notifications → navigate to the order detail / active ride
          navRef.current.navigate('ActiveRide', { orderId: data.orderId });
        }
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navRef}>
        {isLoggedIn ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
