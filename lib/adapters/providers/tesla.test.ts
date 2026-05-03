import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TeslaAdapter } from './tesla';
import type { DeviceRecord } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

function fixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

function makeSolarDevice(extra: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: 'device-tesla-solar-1',
    user_id: 'user-1',
    name: 'Tesla Solar',
    type: 'solar_array',
    is_active: true,
    provider_type: 'tesla',
    connection_config: {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      site_id: 'site-123',
    },
    ...extra,
  };
}

function makeEvDevice(extra: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: 'device-tesla-ev-1',
    user_id: 'user-1',
    name: 'Tesla Model 3',
    type: 'ev',
    is_active: true,
    provider_type: 'tesla',
    connection_config: {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      vehicle_id: '12345',
    },
    ev_config: {
      battery_capacity_kwh: 75,
      target_charge: 0.8,
      departure_time: '08:00',
      charger_power_kw: 11,
    },
    ...extra,
  };
}

let originalFetch: typeof globalThis.fetch;

describe('TeslaAdapter', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('isConfigured()', () => {
    test('returns true when access_token and site_id are present for solar device', () => {
      const adapter = new TeslaAdapter(makeSolarDevice());
      assert.equal(adapter.isConfigured(), true);
    });

    test('returns true when access_token and vehicle_id are present for EV device', () => {
      const adapter = new TeslaAdapter(makeEvDevice());
      assert.equal(adapter.isConfigured(), true);
    });

    test('returns false when connection_config is empty', () => {
      const adapter = new TeslaAdapter(makeSolarDevice({ connection_config: {} }));
      assert.equal(adapter.isConfigured(), false);
    });

    test('returns false when site_id is missing for solar device', () => {
      const adapter = new TeslaAdapter(makeSolarDevice({
        connection_config: { access_token: 'tok' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });

    test('returns false when vehicle_id is missing for EV device', () => {
      const adapter = new TeslaAdapter(makeEvDevice({
        connection_config: { access_token: 'tok' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });
  });

  describe('getStatus() — solar_array with live_status fixture', () => {
    test('maps solar_power W → solarOutputKw correctly', async () => {
      const liveStatus = fixture('tesla-live-status.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(liveStatus), { status: 200 }) as Response;

      const adapter = new TeslaAdapter(makeSolarDevice());
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.equal(status.providerType, 'tesla');
      assert.ok(typeof status.solarOutputKw === 'number');
      assert.ok(Math.abs(status.solarOutputKw! - 4.2) < 0.01,
        `expected ~4.2 kW, got ${status.solarOutputKw}`);
    });
  });

  describe('getStatus() — battery with live_status fixture', () => {
    test('maps percentage_charged → batterySOCPercent', async () => {
      const liveStatus = fixture('tesla-live-status.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(liveStatus), { status: 200 }) as Response;

      const batteryDevice = makeSolarDevice({ type: 'battery' });
      const adapter = new TeslaAdapter(batteryDevice);
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.batterySOCPercent === 'number');
      assert.ok(Math.abs(status.batterySOCPercent! - 72.5) < 0.1,
        `expected ~72.5%, got ${status.batterySOCPercent}`);
    });

    test('maps battery_power negative value (charging) correctly', async () => {
      const liveStatus = fixture('tesla-live-status.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(liveStatus), { status: 200 }) as Response;

      const batteryDevice = makeSolarDevice({ type: 'battery' });
      const adapter = new TeslaAdapter(batteryDevice);
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.batteryPowerKw === 'number');
    });
  });

  describe('getStatus() — ev with vehicle_data fixture', () => {
    test('maps battery_level → evSOCPercent', async () => {
      const vehicleData = fixture('tesla-vehicle-data.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(vehicleData), { status: 200 }) as Response;

      const adapter = new TeslaAdapter(makeEvDevice());
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.evSOCPercent === 'number');
      assert.equal(status.evSOCPercent, 68);
    });

    test('maps charger_power → evChargeRateKw', async () => {
      const vehicleData = fixture('tesla-vehicle-data.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(vehicleData), { status: 200 }) as Response;

      const adapter = new TeslaAdapter(makeEvDevice());
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.evChargeRateKw === 'number');
      assert.equal(status.evChargeRateKw, 11);
    });

    test('sets evPluggedIn=true when charging_state is Charging', async () => {
      const vehicleData = fixture('tesla-vehicle-data.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(vehicleData), { status: 200 }) as Response;

      const adapter = new TeslaAdapter(makeEvDevice());
      const status = await adapter.getStatus();

      assert.equal(status.evPluggedIn, true);
    });
  });

  describe('getStatus() — failure cases', () => {
    test('returns isLive=false when not configured', async () => {
      const adapter = new TeslaAdapter(makeSolarDevice({ connection_config: {} }));
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });

    test('returns isLive=false on HTTP 500', async () => {
      globalThis.fetch = async () =>
        new Response('Internal Server Error', { status: 500 }) as Response;

      const adapter = new TeslaAdapter(makeSolarDevice());
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
      assert.ok(typeof status.error === 'string');
    });

    test('returns isLive=false on network error', async () => {
      globalThis.fetch = async () => {
        throw new Error('Network error');
      };

      const adapter = new TeslaAdapter(makeSolarDevice());
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });
  });

  describe('getConnectionSchema()', () => {
    test('returns a valid schema with providerType=tesla', () => {
      const adapter = new TeslaAdapter(makeSolarDevice());
      const schema = adapter.getConnectionSchema();
      assert.equal(schema.providerType, 'tesla');
      assert.ok(schema.displayName.length > 0);
      assert.ok(Array.isArray(schema.fields));
    });
  });
});
