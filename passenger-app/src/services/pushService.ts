/**
 * Push notification service — passenger app.
 *
 * Responsibilities:
 *   1. Request system permission for notifications.
 *   2. Obtain the Expo push token for this device.
 *   3. Configure an Android notification channel.
 *   4. Set the global notification handler (how alerts appear in foreground).
 *
 * Usage:
 *   Call registerForPushNotifications() once after login; the returned token
 *   is sent to the backend via notificationsApi.registerToken().
 *
 * Note: Expo push notifications require a development build. Remote push was
 * removed from Expo Go in SDK 53. This module detects Expo Go and skips all
 * push setup gracefully — the rest of the app works normally.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Expo Go (storeClient) does not support remote push since SDK 53.
// Skip all push setup to avoid the runtime error.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

if (!IS_EXPO_GO) {
  // ── Foreground handler ──────────────────────────────────────────
  // Show alert + badge + sound even when the app is in the foreground.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // ── Android default channel ──────────────────────────────────────
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'CrypGo',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F7931A',
    }).catch(() => undefined);
  }
}

/**
 * Request notification permission and return the Expo push token.
 * Returns null in Expo Go, on simulators, or when permission is denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (IS_EXPO_GO) {
    if (__DEV__) console.log('[Push] Skipped: Expo Go does not support remote push (SDK 53+)');
    return null;
  }

  if (!Device.isDevice) {
    if (__DEV__) console.log('[Push] Skipped: not a physical device');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('[Push] Permission denied');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    if (__DEV__) console.log('[Push] Token:', tokenData.data.slice(0, 30) + '...');
    return tokenData.data;
  } catch (err) {
    if (__DEV__) console.warn('[Push] Failed to get token:', err);
    return null;
  }
}
