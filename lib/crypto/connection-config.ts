/**
 * Server-side AES-256-GCM encryption for device connection_config credentials.
 *
 * Key setup: Set CONNECTION_CONFIG_SECRET in your environment as a 64-character
 * hex string (32 bytes). Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * In development without a key set, a fixed dev-only placeholder is used and
 * a warning is logged. In production this should always be set.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEV_FALLBACK_KEY = 'a'.repeat(64);

function getKey(): Buffer {
  const hexKey = process.env.CONNECTION_CONFIG_SECRET;
  if (!hexKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CONNECTION_CONFIG_SECRET environment variable is required in production'
      );
    }
    console.warn(
      '[connection-config] CONNECTION_CONFIG_SECRET not set. Using insecure dev fallback. Set this variable before storing real credentials.'
    );
    return Buffer.from(DEV_FALLBACK_KEY, 'hex');
  }
  if (hexKey.length !== 64) {
    throw new Error(
      'CONNECTION_CONFIG_SECRET must be a 64-character hex string (32 bytes)'
    );
  }
  return Buffer.from(hexKey, 'hex');
}

export interface EncryptedPayload extends Record<string, unknown> {
  __encrypted: string;
}

export function encryptConnectionConfig(
  data: Record<string, unknown>
): EncryptedPayload {
  if (Object.keys(data).length === 0) {
    return { __encrypted: '' };
  }

  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload = [
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');

  return { __encrypted: payload };
}

export function decryptConnectionConfig(
  stored: Record<string, unknown>
): Record<string, unknown> {
  const payload = stored as Partial<EncryptedPayload>;

  if (!payload.__encrypted) {
    return {};
  }

  try {
    const [ivHex, tagHex, ciphertextHex] = payload.__encrypted.split(':');
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  } catch (err) {
    console.error('[connection-config] Decryption failed:', err);
    return {};
  }
}

export function isConfigured(stored: Record<string, unknown>): boolean {
  const payload = stored as Partial<EncryptedPayload>;
  return !!(payload.__encrypted && payload.__encrypted.length > 0);
}

export function maskForClient(stored: Record<string, unknown>): {
  is_configured: boolean;
} {
  return { is_configured: isConfigured(stored) };
}
