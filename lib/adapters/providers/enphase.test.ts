import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnphaseAdapter } from './enphase';
import type { DeviceRecord } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

function fixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

function makeSolarDevice(extra: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: 'device-enphase-solar-1',
    user_id: 'user-1',
    name: 'Enphase Solar',
    type: 'solar_array',
    is_active: true,
    provider_type: 'enphase',
    connection_config: {
      api_key: 'test-api-key',
      access_token: 'test-access-token',
      refresh_token: 'test-refresh',
      system_id: '67890',
    },
    ...extra,
  };
}

function makeBatteryDevice(extra: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    ...makeSolarDevice(),
    id: 'device-enphase-battery-1',
    name: 'Enphase Battery',
    type: 'battery',
    battery_config: { capacity_kwh: 10, max_flow_kw: 5 },
    ...extra,
  };
}

let originalFetch: typeof globalThis.fetch;

describe('EnphaseAdapter', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('isConfigured()', () => {
    test('returns true when api_key, access_token, and system_id are present', () => {
      const adapter = new EnphaseAdapter(makeSolarDevice());
      assert.equal(adapter.isConfigured(), true);
    });

    test('returns false when connection_config is empty', () => {
      const adapter = new EnphaseAdapter(makeSolarDevice({ connection_config: {} }));
      assert.equal(adapter.isConfigured(), false);
    });

    test('returns false when api_key is missing', () => {
      const adapter = new EnphaseAdapter(makeSolarDevice({
        connection_config: { access_token: 'tok', system_id: '123' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });
  });

  describe('getStatus() — solar_array with summary fixture', () => {
    test('maps current_power W → solarOutputKw correctly', async () => {
      const summary = fixture('enphase-summary.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(summary), { status: 200 }) as Response;

      const adapter = new EnphaseAdapter(makeSolarDevice());
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.equal(status.providerType, 'enphase');
      assert.ok(typeof status.solarOutputKw === 'number');
      assert.ok(Math.abs(status.solarOutputKw! - 3.75) < 0.01,
        `expected ~3.75 kW (3750 W), got ${status.solarOutputKw}`);
    });
  });

  describe('getStatus() — battery with telemetry fixture', () => {
    test('maps last battery interval soc.percent → batterySOCPercent', async () => {
      const telemetry = fixture('enphase-battery-telemetry.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(telemetry), { status: 200 }) as Response;

      const adapter = new EnphaseAdapter(makeBatteryDevice());
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.batterySOCPercent === 'number');
      assert.equal(status.batterySOCPercent, 88,
        `expected 88% SoC from last interval, got ${status.batterySOCPercent}`);
    });

    test('computes battery power from charge/discharge enwh of last interval', async () => {
      const telemetry = fixture('enphase-battery-telemetry.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(telemetry), { status: 200 }) as Response;

      const adapter = new EnphaseAdapter(makeBatteryDevice());
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.batteryPowerKw === 'number',
        'batteryPowerKw should be set');
      assert.ok(status.batteryPowerKw! > 0, 'charging state should yield positive batteryPowerKw');
    });
  });

  describe('getStatus() — failure cases', () => {
    test('returns isLive=false when not configured', async () => {
      const adapter = new EnphaseAdapter(makeSolarDevice({ connection_config: {} }));
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });

    test('returns isLive=false on HTTP 403', async () => {
      globalThis.fetch = async () =>
        new Response('Forbidden', { status: 403 }) as Response;

      const adapter = new EnphaseAdapter(makeSolarDevice());
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });
  });

  describe('getConnectionSchema()', () => {
    test('returns valid schema with providerType=enphase', () => {
      const adapter = new EnphaseAdapter(makeSolarDevice());
      const schema = adapter.getConnectionSchema();
      assert.equal(schema.providerType, 'enphase');
      assert.ok(schema.fields.length > 0);
    });
  });
});
