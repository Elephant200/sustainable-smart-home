import { test, describe, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SolarEdgeAdapter } from './solaredge';
import type { DeviceRecord } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

function fixture(name: string) {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

function makeDevice(type: DeviceRecord['type'] = 'solar_array', extra: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    id: 'device-se-1',
    user_id: 'user-1',
    name: 'SolarEdge Site',
    type,
    is_active: true,
    provider_type: 'solaredge',
    connection_config: {
      api_key: 'test-se-key',
      site_id: 'site-999',
    },
    ...(type === 'battery' ? { battery_config: { capacity_kwh: 9.8, max_flow_kw: 5 } } : {}),
    ...extra,
  };
}

let originalFetch: typeof globalThis.fetch;

describe('SolarEdgeAdapter', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('isConfigured()', () => {
    test('returns true when api_key and site_id are present', () => {
      const adapter = new SolarEdgeAdapter(makeDevice());
      assert.equal(adapter.isConfigured(), true);
    });

    test('returns false when api_key is missing', () => {
      const adapter = new SolarEdgeAdapter(makeDevice('solar_array', {
        connection_config: { site_id: '123' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });

    test('returns false when site_id is missing', () => {
      const adapter = new SolarEdgeAdapter(makeDevice('solar_array', {
        connection_config: { api_key: 'key' },
      }));
      assert.equal(adapter.isConfigured(), false);
    });
  });

  describe('getStatus() — solar_array', () => {
    test('maps PV.currentPower kW → solarOutputKw', async () => {
      const powerFlow = fixture('solaredge-current-power-flow.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlow), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('solar_array'));
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.equal(status.providerType, 'solaredge');
      assert.ok(Math.abs(status.solarOutputKw! - 3.75) < 0.01,
        `expected 3.75 kW, got ${status.solarOutputKw}`);
    });
  });

  describe('getStatus() — battery', () => {
    test('maps STORAGE.chargeLevel → batterySOCPercent', async () => {
      const powerFlow = fixture('solaredge-current-power-flow.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlow), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('battery'));
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.equal(status.batterySOCPercent, 68,
        `expected 68% SoC from chargeLevel, got ${status.batterySOCPercent}`);
    });

    test('charging status yields positive batteryPowerKw', async () => {
      const powerFlow = fixture('solaredge-current-power-flow.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlow), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('battery'));
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(typeof status.batteryPowerKw === 'number');
      assert.ok(status.batteryPowerKw! > 0,
        `charging state should yield positive batteryPowerKw, got ${status.batteryPowerKw}`);
    });

    test('computes batterySOCKwh when battery_config is present', async () => {
      const powerFlow = fixture('solaredge-current-power-flow.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlow), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('battery'));
      const status = await adapter.getStatus();

      assert.ok(typeof status.batterySOCKwh === 'number');
      const expectedKwh = (68 / 100) * 9.8;
      assert.ok(Math.abs(status.batterySOCKwh! - expectedKwh) < 0.01,
        `expected ~${expectedKwh.toFixed(2)} kWh, got ${status.batterySOCKwh}`);
    });
  });

  describe('getStatus() — house', () => {
    test('maps LOAD.currentPower kW → houseLoadKw', async () => {
      const powerFlow = fixture('solaredge-current-power-flow.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlow), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('house'));
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(Math.abs(status.houseLoadKw! - 4.2) < 0.01,
        `expected 4.2 kW, got ${status.houseLoadKw}`);
    });
  });

  describe('getStatus() — grid', () => {
    test('maps GRID.currentPower kW → gridImportKw', async () => {
      const powerFlow = fixture('solaredge-current-power-flow.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlow), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('grid'));
      const status = await adapter.getStatus();

      assert.equal(status.isLive, true);
      assert.ok(Math.abs(status.gridImportKw! - 0.5) < 0.01,
        `expected 0.5 kW import, got ${status.gridImportKw}`);
    });

    test('populates houseLoadKwSystem from LOAD when device is grid type', async () => {
      const powerFlow = fixture('solaredge-current-power-flow.json');
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlow), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('grid'));
      const status = await adapter.getStatus();

      assert.ok(typeof status.houseLoadKwSystem === 'number',
        'houseLoadKwSystem should be set for grid device');
      assert.ok(Math.abs(status.houseLoadKwSystem! - 4.2) < 0.01);
    });
  });

  describe('unit conversion toKw()', () => {
    test('converts W unit to kW (1/1000)', async () => {
      const powerFlowW = {
        siteCurrentPowerFlow: {
          unit: 'W',
          PV: { currentPower: 3750 },
          LOAD: { currentPower: 4200 },
          GRID: { currentPower: 500 },
          STORAGE: { status: 'Charging', currentPower: 1050, chargeLevel: 68 },
        },
      };
      globalThis.fetch = async () =>
        new Response(JSON.stringify(powerFlowW), { status: 200 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice('solar_array'));
      const status = await adapter.getStatus();
      assert.ok(Math.abs(status.solarOutputKw! - 3.75) < 0.01,
        `W→kW conversion failed: expected 3.75, got ${status.solarOutputKw}`);
    });
  });

  describe('getStatus() — failure cases', () => {
    test('returns isLive=false when not configured', async () => {
      const adapter = new SolarEdgeAdapter(makeDevice('solar_array', { connection_config: {} }));
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });

    test('returns isLive=false on HTTP 429', async () => {
      globalThis.fetch = async () =>
        new Response('Too Many Requests', { status: 429 }) as Response;

      const adapter = new SolarEdgeAdapter(makeDevice());
      const status = await adapter.getStatus();
      assert.equal(status.isLive, false);
    });
  });

  describe('getConnectionSchema()', () => {
    test('returns valid schema with providerType=solaredge', () => {
      const adapter = new SolarEdgeAdapter(makeDevice());
      const schema = adapter.getConnectionSchema();
      assert.equal(schema.providerType, 'solaredge');
      assert.ok(schema.fields.some((f) => f.key === 'api_key'));
      assert.ok(schema.fields.some((f) => f.key === 'site_id'));
    });
  });
});
