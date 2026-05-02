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
  const [iv, tag, ct] = encrypted.__encrypted.split(':');
  const flippedCt = ct.startsWith('0')
    ? '1' + ct.slice(1)
    : '0' + ct.slice(1);
  const tampered = { __encrypted: [iv, tag, flippedCt].join(':') };
  const result = decryptConnectionConfig(tampered);
  assert.deepEqual(result, {});
});

test('rejects malformed payload (tampered auth tag)', () => {
  const encrypted = encryptConnectionConfig({ token: 'real' });
  const [iv, tag, ct] = encrypted.__encrypted.split(':');
  const flippedTag = tag.startsWith('0')
    ? '1' + tag.slice(1)
    : '0' + tag.slice(1);
  const tampered = { __encrypted: [iv, flippedTag, ct].join(':') };
  const result = decryptConnectionConfig(tampered);
  assert.deepEqual(result, {});
});

test('rejects payload encrypted with a different key', () => {
  const encrypted = encryptConnectionConfig({ token: 'real' });
  const original = process.env.CONNECTION_CONFIG_SECRET;
  process.env.CONNECTION_CONFIG_SECRET = 'c'.repeat(64);
  const result = decryptConnectionConfig(encrypted);
  process.env.CONNECTION_CONFIG_SECRET = original;
  assert.deepEqual(result, {});
});

test('treats stored value with no __encrypted field as empty plaintext', () => {
  assert.deepEqual(decryptConnectionConfig({}), {});
  assert.deepEqual(decryptConnectionConfig({ some: 'legacy-field' }), {});
  assert.equal(isConfigured({}), false);
});
