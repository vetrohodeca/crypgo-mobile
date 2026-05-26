/**
 * Breez SDK Service — абстракционен слой за Lightning плащания.
 *
 * Breez SDK React Native bindings изискват native модули (expo-dev-client
 * или bare workflow). За thesis MVP използваме DEV_MODE stub.
 *
 * В production:
 *   npm install @breez-sdk-liquid/react-native
 *   → replace stub с реална имплементация
 *
 * Отговорности:
 *   - Генериране на преimage локално (32 random bytes → hex)
 *   - SHA256 хеш на преimage → payment_hash за backend-а
 *   - Изпращане на Lightning плащане (BOLT11 invoice)
 */
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

const DEV_MODE = __DEV__; // Expo: true в development

// ── Types ─────────────────────────────────────────────────────────

export interface BreezWalletInfo {
  nodeId: string;         // Lightning node публичен ключ (ln_node_id)
  balanceSats: number;    // Наличен баланс в сатоши
}

export interface PaymentResult {
  preimage: string;       // 64 hex — съхранявай само на устройството
  paymentHash: string;    // 64 hex — изпраща се към backend-а
  amountSats: number;
}

// ── Генериране на preimage ────────────────────────────────────────
//
// СИГУРНОСТ: preimage се генерира САМО на устройството на пътника.
// Сървърът получава само SHA256(preimage) = payment_hash.

export async function generatePreimage(): Promise<{
  preimage: string;
  paymentHash: string;
}> {
  // 32 cryptographically secure random bytes
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  // Uint8Array → hex string без Buffer (не е наличен в RN)
  const preimage = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(''); // 64 hex символа

  // SHA256(preimage) = payment_hash
  const paymentHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    preimage,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  return { preimage, paymentHash };
}

// ── Breez SDK инициализация ───────────────────────────────────────

export async function initBreezSDK(apiKey: string, seedPhrase?: string): Promise<BreezWalletInfo> {
  if (DEV_MODE) {
    console.log('[Breez DEV] initBreezSDK — stub mode');
    return {
      nodeId: '02' + 'a'.repeat(64), // Симулиран node ID
      balanceSats: 1_000_000,
    };
  }

  // Production: реална Breez SDK инициализация
  // const sdk = await BreezSDKLiquid.connect({ apiKey, ... });
  throw new Error(
    'Breez SDK изисква expo-dev-client. Стартирайте с: npx expo run:android',
  );
}

// ── Изпращане на Lightning плащане ────────────────────────────────

export async function payBolt11Invoice(
  bolt11: string,
  amountSats?: number,
): Promise<PaymentResult> {
  if (DEV_MODE) {
    console.log(`[Breez DEV] payBolt11Invoice — stub: ${bolt11.slice(0, 30)}...`);

    // В DEV_MODE симулираме успешно плащане
    await new Promise((r) => setTimeout(r, 1500)); // фиктивно забавяне

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

// ── Информация за портфейла ────────────────────────────────────────

export async function getWalletInfo(): Promise<BreezWalletInfo> {
  if (DEV_MODE) {
    return { nodeId: '02' + 'a'.repeat(64), balanceSats: 1_000_000 };
  }
  throw new Error('Breez SDK не е инициализиран');
}

// ── Platform info (за дебъгване) ─────────────────────────────────

export const PLATFORM = Platform.OS;
