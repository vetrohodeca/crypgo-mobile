/**
 * Push notification service — driver app.
 *
 * Responsibilities:
 *   1. Request system permission for notifications.
 *   2. Obtain the Expo push token for this device.
 *   3. Configure an Android notification channel.
 *   4. Set the global notification handler (how alerts appear in foreground).
 *
 * Note: Expo push notifications require a development build (not Expo Go on
 * Android/iOS). Remote push is disabled in the Expo Go sandbox since SDK 53.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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
    name: 'CrypGo Driver',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#F7931A',
  }).catch(() => undefined);
}

/**
 * Request notification permission and return the Expo push token.
 * Returns null when permission is denied or the device is a simulator.
 */
export async function registerForPushNotifications(): Promise<string | null> {
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
