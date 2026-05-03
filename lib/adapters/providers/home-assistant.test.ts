import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HomeAssistantAdapter } from './home-assistant';
import type { DeviceRecord } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

function fixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

// Use a non-private, non-loopback test host in non-production to avoid SSRF guard.
const TEST_BASE_URL = 'http://ha-test.example.com:8123';

function makeDevice(type: DeviceRecord['type'] = 'solar_array', extra: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: 'device-ha-1',
    user_id: 'user-1',
    name: 'Home Assistant',
    type,
    is_active: true,
    provider_type: 'home_assistant',
    connection_config: {
      base_url: TEST_BASE_URL,
      token: 'test-long-lived-token',
      entity_id: 'sensor.solar_power',
    },
    ...(type === 'battery' ? {
      battery_config: { capacity_kwh: 10, max_flow_kw: 5 },
      connection_config: {
        base_url: TEST_BASE_URL,
        token: 'test-long-lived-token',
        entity_id: 'sensor.battery_soc',
      },
    } : {}),
    ...extra,
  };
}

let originalFetch: typeof globalThis.fetch;
const origNodeEnv = process.env.NODE_ENV;

describe('HomeAssistantAdapter', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = origNodeEnv;
  });

  describe('isConfigured()', () => {
    test('returns true when base_url, token, and entity_id are present', () => {
      const adapter = new HomeAssistantAdapter(makeDevice());
      assert.equal(adapter.isConfigured(), true);
    });

    test('returns false when connection_config is empty', () => {
      const adapter = new HomeAssistantAdapter(makeDevice('solar_array', { connection_config: {} }));
      assert.equal(adapter.isConfigured(), false);
    });

    test('returns false when token is missing', () => {
      const adapter = new HomeAssistantAdapter(makeDevice('solar_array', {
        connection_config: { base_url: TEST_BASE_URL, entity_id: 'sensor.x' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });
  });

  describe('getStatus() — solar_array', () => {
    test('maps W power state → solarOutputKw via unit_of_measurement', async () => {
      const solarState = fixture('home-assistant-solar-state.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(solarState), { status: 200 }) as Response;

      const adapter = new HomeAssistantAdapter(makeDevice('solar_array'));
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.equal(status.providerType, 'home_assistant');
      assert.ok(Math.abs(status.solarOutputKw! - 3.7505) < 0.001,
        `expected ~3.7505 kW (3750.5 W / 1000), got ${status.solarOutputKw}`);
    });
  });

  describe('getStatus() — battery', () => {
    test('maps % state → batterySOCPercent', async () => {
      const battState = fixture('home-assistant-battery-state.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(battState), { status: 200 }) as Response;

      const adapter = new HomeAssistantAdapter(makeDevice('battery'));
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(Math.abs(status.batterySOCPercent! - 72.3) < 0.01,
        `expected 72.3% SoC, got ${status.batterySOCPercent}`);
    });
  });

  describe('getStatus() — failure cases', () => {
    test('returns isLive=false when not configured', async () => {
      const adapter = new HomeAssistantAdapter(makeDevice('solar_array', { connection_config: {} }));
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });

    test('returns isLive=false on HTTP 401', async () => {
      globalThis.fetch = async () =>
        new Response('Unauthorized', { status: 401 }) as Response;

      const adapter = new HomeAssistantAdapter(makeDevice());
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });

    test('returns isLive=false when entity state is non-numeric', async () => {
      const unavailableState = {
        entity_id: 'sensor.solar_power',
        state: 'unavailable',
        attributes: { unit_of_measurement: 'W' },
        last_updated: '2024-06-15T14:30:00.000Z',
      };
      globalThis.fetch = async () =>
        new Response(JSON.stringify(unavailableState), { status: 200 }) as Response;

      const adapter = new HomeAssistantAdapter(makeDevice());
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
      assert.ok(status.error?.includes('non-numeric'));
    });

    test('blocks private IP base_url in production', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const privateDevice = makeDevice('solar_array', {
        connection_config: {
          base_url: 'http://192.168.1.10:8123',
          token: 'tok',
          entity_id: 'sensor.solar',
        },
      });
      const adapter = new HomeAssistantAdapter(privateDevice);
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
      assert.ok(status.error?.includes('SSRF') || status.error?.includes('base_url'));

      process.env.NODE_ENV = origEnv;
    });
  });

  describe('getConnectionSchema()', () => {
    test('returns valid schema with providerType=home_assistant', () => {
      const adapter = new HomeAssistantAdapter(makeDevice());
      const schema = adapter.getConnectionSchema();
      assert.equal(schema.providerType, 'home_assistant');
      assert.ok(schema.fields.some((f) => f.key === 'base_url'));
      assert.ok(schema.fields.some((f) => f.key === 'token'));
      assert.ok(schema.fields.some((f) => f.key === 'entity_id'));
    });
  });
});
