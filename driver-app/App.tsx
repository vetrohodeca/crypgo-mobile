import 'react-native-screens';
import React from 'react';
import { LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import { StatusBar }            from 'expo-status-bar';
import { useAuthStore }         from './src/store/useAuthStore';
import AuthNavigator            from './src/navigation/AuthNavigator';
import AppNavigator             from './src/navigation/AppNavigator';

// ── Suppress known Expo SDK 56 / RN 0.76 Fabric renderer warnings ──────────
// "createAnimatedNode: Animated node [N] already exists" is a framework-level
// race condition between the new Fabric renderer and React Navigation's
// Animated-based tab/stack transitions.  It does not affect runtime behaviour
// and cannot be fixed in user code.
LogBox.ignoreLogs([
  'createAnimatedNode: Animated node',
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
