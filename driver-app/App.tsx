import 'react-native-screens';
import React from 'react';
import { LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import { StatusBar }            from 'expo-status-bar';
import { useAuthStore }         from './src/store/useAuthStore';
import AuthNavigator            from './src/navigation/AuthNavigator';
import AppNavigator             from './src/navigation/AppNavigator';

// ── Suppress known Expo Go / RN 0.76 framework warnings ───────────────────
LogBox.ignoreLogs([
  // Fabric renderer race condition with React Navigation animations.
  // Does not affect runtime behaviour; cannot be fixed in user code.
  'createAnimatedNode: Animated node',

  // Background location is intentionally unavailable in Expo Go on Android.
  // The driver app uses foreground watchPositionAsync for the demo; background
  // tracking (expo-task-manager) only activates in a production / dev-client build.
  'Background location is limited in Expo Go',
]);

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {isLoggedIn ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
