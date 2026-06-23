/**
 * Breez SDK Service — abstraction layer for Lightning payments.
 *
 * Breez SDK React Native bindings require native modules (expo-dev-client
 * or bare workflow). For the thesis MVP we use a DEV_MODE stub.
 *
 * In production:
 *   npm install @breez-sdk-liquid/react-native
 *   -> replace stub with real implementation
 *
 * Responsibilities:
 *   - Generate preimage locally (32 random bytes -> hex)
 *   - SHA256 hash of preimage -> payment_hash for the backend
 *   - Send Lightning payment (BOLT11 invoice)
 */
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

const DEV_MODE = __DEV__; // Expo: true in development

// ── Types ─────────────────────────────────────────────────────────

export interface BreezWalletInfo {
  nodeId: string;         // Lightning node public key (ln_node_id)
  balanceSats: number;    // Available balance in satoshis
}

export interface PaymentResult {
  preimage: string;       // 64 hex — store only on the device
  paymentHash: string;    // 64 hex — sent to the backend
  amountSats: number;
}

// Generate preimage
//
// SECURITY: preimage is generated ONLY on the passenger's device.
// The server receives only SHA256(preimage) = payment_hash.

export async function generatePreimage(): Promise<{
  preimage: string;
  paymentHash: string;
}> {
  // 32 cryptographically secure random bytes
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  // Uint8Array -> hex string without Buffer (not available in RN)
  const preimage = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(''); // 64 hex characters

  // SHA256(preimage) = payment_hash
  const paymentHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    preimage,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  return { preimage, paymentHash };
}

// Breez SDK initialisation

export async function initBreezSDK(apiKey: string, seedPhrase?: string): Promise<BreezWalletInfo> {
  if (DEV_MODE) {
    console.log('[Breez DEV] initBreezSDK — stub mode');
    return {
      nodeId: '02' + 'a'.repeat(64), // Simulated node ID
      balanceSats: 1_000_000,
    };
  }

  // Production: real Breez SDK initialisation
  // const sdk = await BreezSDKLiquid.connect({ apiKey, ... });
  throw new Error(
    'Breez SDK изисква expo-dev-client. Стартирайте с: npx expo run:android',
  );
}

// Send Lightning payment

export async function payBolt11Invoice(
  bolt11: string,
  amountSats?: number,
): Promise<PaymentResult> {
  if (DEV_MODE) {
    console.log(`[Breez DEV] payBolt11Invoice — stub: ${bolt11.slice(0, 30)}...`);

    // In DEV_MODE simulate a successful payment
    await new Promise((r) => setTimeout(r, 1500)); // simulated delay

    const { preimage, paymentHash } = await generatePreimage();
    return {
      preimage,
      paymentHash,
      amountSats: amountSats ?? 4000,
    };
  }

  // Production: BreezSDKLiquid.payBolt11Invoice({ bolt11 })
  throw new Error('Breez SDK не е инициализиран');
}

// Wallet information

export async function getWalletInfo(): Promise<BreezWalletInfo> {
  if (DEV_MODE) {
    return { nodeId: '02' + 'a'.repeat(64), balanceSats: 1_000_000 };
  }
  throw new Error('Breez SDK не е инициализиран');
}

// Platform info (for debugging)

export const PLATFORM = Platform.OS;
