import 'react-native-screens';
import React, { useEffect, useRef } from 'react';
import { LogBox, Platform } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import { StatusBar }            from 'expo-status-bar';
import * as Notifications       from 'expo-notifications';
import { useAuthStore }         from './src/store/useAuthStore';
import AuthNavigator            from './src/navigation/AuthNavigator';
import AppNavigator             from './src/navigation/AppNavigator';
import { registerForPushNotifications } from './src/services/pushService';
import { notificationsApi }     from '@cryptgo/shared';
import type { AppStackParamList } from './src/navigation/types';

// ── Suppress known Expo SDK 56 / RN 0.76 Fabric renderer warnings ──────────
LogBox.ignoreLogs([
  'createAnimatedNode: Animated node',
]);

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const pushTokenRef = useRef<string | null>(null);
  const navRef = useRef<NavigationContainerRef<AppStackParamList>>(null);

  // ── Register push token on login ──────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) {
      // On logout: unregister the token if we have one
      if (pushTokenRef.current) {
        notificationsApi
          .removeToken(pushTokenRef.current)
          .catch(() => undefined);
        pushTokenRef.current = null;
      }
      return;
    }

    // On login: get the Expo push token and register it with the backend
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
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          type?: string;
          orderId?: string;
        };
        if (data?.orderId && navRef.current) {
          // All order-related notifications deep-link to the Tracking screen
          navRef.current.navigate('Tracking', { orderId: data.orderId });
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
