/**
 * preimageService — Encrypted on-device storage for the preimage.
 *
 * SECURITY: The preimage is the key for releasing the Lightning payment.
 * We use expo-secure-store (iOS Keychain / Android Keystore) to:
 *   - Survive Expo fast refresh and app restart
 *   - Never be written in plaintext anywhere
 *   - Be automatically deleted on app uninstall
 *
 * Secure store key structure:
 *   key: "preimage:<orderId>"   -> value: preimage (64 hex)
 */
import * as SecureStore from 'expo-secure-store';

const PREFIX = 'preimage:';

/**
 * Saves the preimage for a given order in secure storage.
 * Called immediately after generatePreimage() in RequestRideScreen.
 */
export async function savePreimage(orderId: string, preimage: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFIX + orderId, preimage);
  } catch (e) {
    console.error('[preimageService] savePreimage failed:', e);
  }
}

/**
 * Loads the preimage for an order from secure storage.
 * Called in TrackingScreen on mount when pendingInvoice is null.
 * Returns null if the preimage was not found (e.g. another device).
 */
export async function loadPreimage(orderId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PREFIX + orderId);
  } catch (e) {
    console.error('[preimageService] loadPreimage failed:', e);
    return null;
  }
}

/**
 * Deletes the preimage after a successfully completed order.
 * Called after COMPLETED.
 */
export async function clearPreimage(orderId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PREFIX + orderId);
  } catch {
    // silent — may already be deleted
  }
}
