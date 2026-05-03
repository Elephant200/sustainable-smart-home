import { test } from 'node:test';
import { strict as assert } from 'node:assert';

process.env.CONNECTION_CONFIG_SECRET =
  process.env.CONNECTION_CONFIG_SECRET ||
  'b'.repeat(64);

import {
  encryptConnectionConfig,
  decryptConnectionConfig,
  isConfigured,
  maskForClient,
} from './connection-config';

test('round-trips a non-empty credentials object', () => {
  const plaintext = {
    access_token: 'secret-token-123',
    refresh_token: 'refresh-abc',
    vehicle_id: 42,
  };
  const encrypted = encryptConnectionConfig(plaintext);
  assert.ok(encrypted.__encrypted.length > 0);
  assert.ok(!encrypted.__encrypted.includes('secret-token-123'));

  const decrypted = decryptConnectionConfig(encrypted);
  assert.deepEqual(decrypted, plaintext);
});

test('encrypted payload is prefixed with key version', () => {
  const encrypted = encryptConnectionConfig({ token: 'x' });
  assert.ok(encrypted.__encrypted.startsWith('v1:'), 'should start with v1:');
  const parts = encrypted.__encrypted.split(':');
  assert.equal(parts.length, 4, 'versioned format should have 4 colon-separated parts');
});

test('produces a different ciphertext on each encryption (random IV)', () => {
  const plaintext = { token: 'same-value' };
  const a = encryptConnectionConfig(plaintext);
  const b = encryptConnectionConfig(plaintext);
  assert.notEqual(a.__encrypted, b.__encrypted);
  assert.deepEqual(decryptConnectionConfig(a), plaintext);
  assert.deepEqual(decryptConnectionConfig(b), plaintext);
});

test('returns empty payload for empty input and round-trips to {}', () => {
  const encrypted = encryptConnectionConfig({});
  assert.equal(encrypted.__encrypted, '');
  assert.deepEqual(decryptConnectionConfig(encrypted), {});
  assert.equal(isConfigured(encrypted), false);
});

test('isConfigured is true once credentials are stored', () => {
  const encrypted = encryptConnectionConfig({ token: 'x' });
  assert.equal(isConfigured(encrypted), true);
});

test('maskForClient never exposes ciphertext or plaintext', () => {
  const encrypted = encryptConnectionConfig({ token: 'super-secret' });
  const masked = maskForClient(encrypted);
  assert.deepEqual(masked, { is_configured: true });
  assert.equal(JSON.stringify(masked).includes('super-secret'), false);
  assert.equal(JSON.stringify(masked).includes('__encrypted'), false);
});

test('rejects malformed payload (truncated)', () => {
  const result = decryptConnectionConfig({ __encrypted: 'not-a-valid-blob' });
  assert.deepEqual(result, {});
});

test('rejects malformed payload (tampered ciphertext fails auth tag)', () => {
  const encrypted = encryptConnectionConfig({ token: 'real' });
  const [ver, iv, tag, ct] = encrypted.__encrypted.split(':');
  const flippedCt = ct.startsWith('0')
    ? '1' + ct.slice(1)
    : '0' + ct.slice(1);
  const tampered = { __encrypted: [ver, iv, tag, flippedCt].join(':') };
  const result = decryptConnectionConfig(tampered);
  assert.deepEqual(result, {});
});

test('rejects malformed payload (tampered auth tag)', () => {
  const encrypted = encryptConnectionConfig({ token: 'real' });
  const [ver, iv, tag, ct] = encrypted.__encrypted.split(':');
  const flippedTag = tag.startsWith('0')
    ? '1' + tag.slice(1)
    : '0' + tag.slice(1);
  const tampered = { __encrypted: [ver, iv, flippedTag, ct].join(':') };
  const result = decryptConnectionConfig(tampered);
  assert.deepEqual(result, {});
});

test('rejects payload with unknown key version', () => {
  const encrypted = encryptConnectionConfig({ token: 'real' });
  const [, iv, tag, ct] = encrypted.__encrypted.split(':');
  const badVersion = { __encrypted: ['v99', iv, tag, ct].join(':') };
  const result = decryptConnectionConfig(badVersion);
  assert.deepEqual(result, {});
});

test('treats stored value with no __encrypted field as empty plaintext', () => {
  assert.deepEqual(decryptConnectionConfig({}), {});
  assert.deepEqual(decryptConnectionConfig({ some: 'legacy-field' }), {});
  assert.equal(isConfigured({}), false);
});

test('decrypts legacy unversioned format (3-part: iv:tag:ciphertext)', () => {
  const encrypted = encryptConnectionConfig({ legacy: true });
  const parts = encrypted.__encrypted.split(':');
  assert.equal(parts.length, 4, 'sanity-check: versioned payload has 4 parts');
  const [, iv, tag, ct] = parts;
  const legacyPayload = { __encrypted: [iv, tag, ct].join(':') };
  const result = decryptConnectionConfig(legacyPayload);
  assert.deepEqual(result, { legacy: true });
});

// ---------------------------------------------------------------------------
// Missing / misconfigured key scenarios
// ---------------------------------------------------------------------------

test('throws immediately when CONNECTION_CONFIG_SECRET is wrong length (not 64 hex chars)', () => {
  // buildKeyMap() validates key length before storing in the cache, so a bad
  // key causes an eager throw even before any encrypt/decrypt is attempted.
  // We reset the cache so the module re-reads the environment variable.
  const { __resetKeyMapForTesting } = require('./connection-config');
  const original = process.env.CONNECTION_CONFIG_SECRET;
  try {
    __resetKeyMapForTesting();
    process.env.CONNECTION_CONFIG_SECRET = 'tooshort'; // 9 chars — invalid
    assert.throws(
      () => encryptConnectionConfig({ x: 1 }),
      (err: unknown) => err instanceof Error && /64-character hex string/.test(err.message)
    );
  } finally {
    process.env.CONNECTION_CONFIG_SECRET = original;
    __resetKeyMapForTesting(); // restore so remaining tests use the valid key
  }
});

test('missing key: throws in non-test env, uses fallback in test env', () => {
  // The module has two distinct behaviors depending on NODE_ENV:
  //   NODE_ENV=test   → uses 'b'.repeat(64) fallback so tests never fail on key absence
  //   NODE_ENV!=test  → throws immediately so misconfigured servers fail loudly at startup
  const { __resetKeyMapForTesting } = require('./connection-config');
  const originalKey = process.env.CONNECTION_CONFIG_SECRET;
  try {
    __resetKeyMapForTesting();
    delete process.env.CONNECTION_CONFIG_SECRET;

    if (process.env.NODE_ENV === 'test') {
      // test-environment fallback: encrypt/decrypt still works with no key configured
      const encrypted = encryptConnectionConfig({ safe: true });
      assert.ok(encrypted.__encrypted.length > 0);
      assert.deepEqual(decryptConnectionConfig(encrypted), { safe: true });
    } else {
      // production/non-test environment: must throw a clear diagnostic error
      assert.throws(
        () => encryptConnectionConfig({ safe: true }),
        (err: unknown) =>
          err instanceof Error && /No encryption key configured/.test(err.message)
      );
    }
  } finally {
    process.env.CONNECTION_CONFIG_SECRET = originalKey;
    __resetKeyMapForTesting();
  }
});
