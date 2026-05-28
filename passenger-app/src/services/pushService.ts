/**
 * Push notification service — passenger app.
 *
 * Responsibilities:
 *   1. Request system permission for notifications.
 *   2. Obtain the Expo push token for this device.
 *   3. Configure an Android notification channel.
 *   4. Set the global notification handler (how alerts appear in foreground).
 *
 * Expo Go note:
 *   Remote push was removed from Expo Go in SDK 53. A static top-level
 *   `import * as Notifications from 'expo-notifications'` causes the module
 *   to call addPushTokenListener at load time, which throws immediately in
 *   Expo Go. We use a conditional require() so the module never initialises
 *   in the Expo Go runtime.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
// `import type` is erased at compile time — zero runtime cost, safe in Expo Go.
import type * as NotificationsNS from 'expo-notifications';
import type * as DeviceNS from 'expo-device';

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

if (!IS_EXPO_GO) {
  // Lazy require — expo-notifications module code runs only here, never in Expo Go.
  const Notifications = require('expo-notifications') as typeof NotificationsNS;

  // ── Foreground handler ────────────────────────────────────────────
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // ── Android default channel ────────────────────────────────────────
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

  const Device = require('expo-device') as typeof DeviceNS;
  if (!Device.isDevice) {
    if (__DEV__) console.log('[Push] Skipped: not a physical device');
    return null;
  }

  const Notifications = require('expo-notifications') as typeof NotificationsNS;

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
