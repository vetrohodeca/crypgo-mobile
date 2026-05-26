import 'react-native-screens';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider }     from 'react-native-safe-area-context';
import { StatusBar }            from 'expo-status-bar';
import { useAuthStore }         from './src/store/useAuthStore';
import AuthNavigator            from './src/navigation/AuthNavigator';
import AppNavigator             from './src/navigation/AppNavigator';

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
