import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmporiaAdapter } from './emporia';
import type { DeviceRecord } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));

function makeDevice(extra: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: 'device-emporia-1',
    user_id: 'user-1',
    name: 'Emporia Vue',
    type: 'house',
    is_active: true,
    provider_type: 'emporia',
    connection_config: {
      username: 'test@example.com',
      password: 'test-password',
      device_gid: '12345',
    },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Fixtures — real-shape API response payloads from recorded samples.
// ---------------------------------------------------------------------------

const usagesFixture = JSON.parse(
  readFileSync(
    resolve(__dirname, 'fixtures/emporia-device-usages.json'),
    'utf-8'
  )
);

// ---------------------------------------------------------------------------
// isConfigured()
// ---------------------------------------------------------------------------

describe('EmporiaAdapter', () => {
  describe('isConfigured()', () => {
    test('returns true when username, password and device_gid are present', () => {
      const adapter = new EmporiaAdapter(makeDevice());
      assert.equal(adapter.isConfigured(), true);
    });

    test('returns false when connection_config is empty', () => {
      const adapter = new EmporiaAdapter(makeDevice({ connection_config: {} }));
      assert.equal(adapter.isConfigured(), false);
    });

    test('returns false when password is missing', () => {
      const adapter = new EmporiaAdapter(makeDevice({
        connection_config: { username: 'test@example.com', device_gid: '123' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });

    test('returns false when device_gid is missing', () => {
      const adapter = new EmporiaAdapter(makeDevice({
        connection_config: { username: 'test@example.com', password: 'pass' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });
  });

  // ---------------------------------------------------------------------------
  // Response-mapping — fixture-backed tests that do NOT hit the network.
  // The adapter's internal mapping logic is exercised by stubbing globalThis.fetch.
  // ---------------------------------------------------------------------------

  describe('getStatus() response mapping — fixture-backed', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    test('maps 1,2,3 channel kWh/min → kW correctly for house device type', async () => {
      // Fixture has usage=0.058 kWh/min on channel "1,2,3"
      // Expected: houseLoadKw = 0.058 * 60 = 3.48
      globalThis.fetch = async () =>
        new Response(JSON.stringify(usagesFixture), { status: 200 }) as Response;

      // Inject a pre-cached id_token so Cognito auth is bypassed
      const device = makeDevice({
        connection_config: {
          username: 'test@example.com',
          password: 'test-password',
          device_gid: '12345',
          id_token: 'fake-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const adapter = new EmporiaAdapter(device);
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.equal(status.providerType, 'emporia');
      assert.equal(status.deviceId, 'device-emporia-1');
      // kWh/min → kW: 0.058 * 60 = 3.48
      assert.ok(typeof status.houseLoadKw === 'number', 'houseLoadKw should be a number');
      assert.ok(
        Math.abs(status.houseLoadKw! - 3.48) < 0.001,
        `Expected houseLoadKw ≈ 3.48, got ${status.houseLoadKw}`
      );
    });

    test('maps grid device type: gridImportKw mirrors houseLoadKw', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify(usagesFixture), { status: 200 }) as Response;

      const device = makeDevice({
        type: 'grid',
        connection_config: {
          username: 'test@example.com',
          password: 'test-password',
          device_gid: '12345',
          id_token: 'fake-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const adapter = new EmporiaAdapter(device);
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.gridImportKw === 'number', 'gridImportKw should be set for grid device');
      assert.ok(typeof status.houseLoadKwSystem === 'number', 'houseLoadKwSystem should be set for grid device');
      assert.ok(
        Math.abs(status.gridImportKw! - status.houseLoadKwSystem!) < 0.001,
        'gridImportKw should equal houseLoadKwSystem'
      );
    });

    test('returns isLive=false on non-OK HTTP status from usages endpoint', async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 }) as Response;

      const device = makeDevice({
        connection_config: {
          username: 'test@example.com',
          password: 'test-password',
          device_gid: '12345',
          id_token: 'fake-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const adapter = new EmporiaAdapter(device);
      const status = await adapter.getStatus();

      assert.equal(status.isLive, false);
      assert.ok(status.error, 'error field should be set');
    });

    test('uses first channelUsage when "1,2,3" channel is absent', async () => {
      // Fixture without the aggregate channel — should fall back to [0]
      const noAggFixture = {
        deviceListUsages: {
          devices: [{
            deviceGid: 12345,
            channelUsages: [
              { channelNum: '1', usage: 0.025, deviceGid: 12345 },
            ],
          }],
        },
      };
      globalThis.fetch = async () =>
        new Response(JSON.stringify(noAggFixture), { status: 200 }) as Response;

      const device = makeDevice({
        connection_config: {
          username: 'test@example.com',
          password: 'test-password',
          device_gid: '12345',
          id_token: 'fake-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      });
      const adapter = new EmporiaAdapter(device);
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      // 0.025 * 60 = 1.5
      assert.ok(
        Math.abs(status.houseLoadKw! - 1.5) < 0.001,
        `Expected houseLoadKw ≈ 1.5, got ${status.houseLoadKw}`
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus() — live network unavailable (Cognito path)
  // ---------------------------------------------------------------------------

  describe('getStatus() — no Cognito auth', () => {
    test('returns isLive=false when Cognito auth fails (network unavailable)', async () => {
      const adapter = new EmporiaAdapter(makeDevice());
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
      assert.equal(status.providerType, 'emporia');
    });
  });

  // ---------------------------------------------------------------------------
  // getConnectionSchema()
  // ---------------------------------------------------------------------------

  describe('getConnectionSchema()', () => {
    test('returns valid schema with providerType=emporia', () => {
      const adapter = new EmporiaAdapter(makeDevice());
      const schema = adapter.getConnectionSchema();
      assert.equal(schema.providerType, 'emporia');
      assert.ok(schema.displayName.length > 0);
      assert.ok(Array.isArray(schema.fields));
      assert.ok(schema.fields.some((f) => f.key === 'username'));
      assert.ok(schema.fields.some((f) => f.key === 'password'));
      assert.ok(schema.fields.some((f) => f.key === 'device_gid'));
    });

    test('marks username and password as required', () => {
      const adapter = new EmporiaAdapter(makeDevice());
      const schema = adapter.getConnectionSchema();
      const usernameField = schema.fields.find((f) => f.key === 'username');
      const passwordField = schema.fields.find((f) => f.key === 'password');
      assert.ok(usernameField?.required, 'username should be required');
      assert.ok(passwordField?.required, 'password should be required');
    });

    test('password field has type=password', () => {
      const adapter = new EmporiaAdapter(makeDevice());
      const schema = adapter.getConnectionSchema();
      const passwordField = schema.fields.find((f) => f.key === 'password');
      assert.equal(passwordField?.type, 'password');
    });
  });
});
