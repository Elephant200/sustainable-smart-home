/**
 * Server-side AES-256-GCM encryption for device connection_config credentials.
 *
 * Key setup: Set CONNECTION_CONFIG_SECRET in your environment as a 64-character
 * hex string (32 bytes). Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Key versioning: The encrypted format is `v1:iv:authTag:ciphertext`.
 * The key map is built from environment variables:
 *   - VERSION "v1" → CONNECTION_CONFIG_SECRET
 *
 * To rotate keys:
 *   1. Set CONNECTION_CONFIG_SECRET_V2 to the new key.
 *   2. Run `npm run migrate:reencrypt` to re-encrypt all rows to v2.
 *   3. Once complete, remove CONNECTION_CONFIG_SECRET and rename V2 → V1.
 *
 * Missing key in non-test environments causes a hard failure at startup.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: 'lib/crypto/connection-config' });

const ALGORITHM = 'aes-256-gcm';
export const CURRENT_KEY_VERSION = 'v1';

function buildKeyMap(): Map<string, Buffer> {
  const map = new Map<string, Buffer>();

  const v1 = process.env.CONNECTION_CONFIG_SECRET;
  if (v1) {
    if (v1.length !== 64) {
      throw new Error('CONNECTION_CONFIG_SECRET must be a 64-character hex string (32 bytes)');
    }
    map.set('v1', Buffer.from(v1, 'hex'));
  }

  const v2 = process.env.CONNECTION_CONFIG_SECRET_V2;
  if (v2) {
    if (v2.length !== 64) {
      throw new Error('CONNECTION_CONFIG_SECRET_V2 must be a 64-character hex string (32 bytes)');
    }
    map.set('v2', Buffer.from(v2, 'hex'));
  }

  return map;
}

let _keyMap: Map<string, Buffer> | null = null;

/** Exposed only for unit tests that need to reset the cached key map. */
export function __resetKeyMapForTesting(): void {
  _keyMap = null;
}

function getKeyMap(): Map<string, Buffer> {
  if (_keyMap) return _keyMap;

  const map = buildKeyMap();

  if (map.size === 0) {
    if (process.env.NODE_ENV === 'test') {
      const fallback = 'b'.repeat(64);
      map.set('v1', Buffer.from(fallback, 'hex'));
    } else {
      throw new Error(
        '[connection-config] No encryption key configured. ' +
        'Set CONNECTION_CONFIG_SECRET (64-char hex) before starting the server. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
  }

  _keyMap = map;
  return _keyMap;
}

/**
 * Call at application startup (e.g. in instrumentation.ts) to eagerly validate
 * that CONNECTION_CONFIG_SECRET is configured AND that the CURRENT_KEY_VERSION
 * key is present. In non-test environments this throws immediately if the key
 * is missing, surfacing misconfiguration before any request is served.
 *
 * Note: having CONNECTION_CONFIG_SECRET_V2 set but not CONNECTION_CONFIG_SECRET
 * would leave the v1 write key absent — this call will catch that.
 */
export function validateKeySetup(): void {
  getCurrentKey(); // throws if CURRENT_KEY_VERSION key is absent
}

function getCurrentKey(): Buffer {
  const map = getKeyMap();
  const key = map.get(CURRENT_KEY_VERSION);
  if (!key) {
    throw new Error(
      `[connection-config] No key found for current version "${CURRENT_KEY_VERSION}". ` +
      'Ensure CONNECTION_CONFIG_SECRET is set.'
    );
  }
  return key;
}

function getKeyForVersion(version: string): Buffer | null {
  return getKeyMap().get(version) ?? null;
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

  const key = getCurrentKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload = [
    CURRENT_KEY_VERSION,
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
    const parts = payload.__encrypted.split(':');

    let version: string;
    let ivHex: string;
    let tagHex: string;
    let ciphertextHex: string;

    if (parts.length === 4 && (parts[0].startsWith('v') || !isHex(parts[0]))) {
      [version, ivHex, tagHex, ciphertextHex] = parts;
    } else if (parts.length === 3) {
      version = 'v1';
      [ivHex, tagHex, ciphertextHex] = parts;
    } else {
      log.error('Unexpected encrypted payload format');
      return {};
    }

    const key = getKeyForVersion(version);
    if (!key) {
      log.error('No key available for encrypted version', { version });
      return {};
    }

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
    log.error('Decryption failed', { error: err instanceof Error ? err.message : String(err) });
    return {};
  }
}

function isHex(s: string): boolean {
  return /^[0-9a-fA-F]+$/.test(s);
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

export function hasStoredCredentials(stored: Record<string, unknown>): boolean {
  return isConfigured(stored);
}
