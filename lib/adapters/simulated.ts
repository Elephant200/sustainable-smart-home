import {
  DeviceAdapter,
  DeviceCommand,
  DeviceRecord,
  DeviceStatus,
  HistoricalPoint,
  HistoryRange,
  ConnectionSchema,
} from './types';
import {
  generateSolarData,
  generateHouseLoadData,
  DeviceConfig,
} from '@/lib/data-generator/client-generators';
import {
  computeSolarArrayInstant,
  computeBatteryStateAt,
  computeEvSocPercent,
  computeEvChargeRateKw,
  computeHouseLoadInstant,
  computeBatteryHistory,
  isOvernightWindow,
  solveFlows,
  type SolarArrayConfig,
  type BatteryDeviceConfig,
  type EvDeviceConfig,
} from '@/lib/simulation';

/**
 * Simulated provider — uses the deterministic physics library.
 * Optionally accepts the user's other device configs so battery/EV/grid
 * status can reflect the full system context (solar surplus, etc).
 *
 * NOTE: this adapter exposes only signals the underlying simulation actually
 * computes. It does NOT synthesize per-module battery breakdowns or per-panel
 * solar telemetry — real provider APIs (Tesla, Enphase, etc.) typically don't
 * expose those either, and inventing them would let placeholder data leak
 * into the dashboard. Routes consume the aggregate device status instead.
 */
export class SimulatedAdapter implements DeviceAdapter {
  readonly providerType = 'simulated' as const;
  private device: DeviceRecord;
  private context: {
    solar: SolarArrayConfig[];
    ev: EvDeviceConfig[];
    battery: BatteryDeviceConfig | null;
  };

  constructor(
    device: DeviceRecord,
    context?: {
      solar?: SolarArrayConfig[];
      ev?: EvDeviceConfig[];
      battery?: BatteryDeviceConfig | null;
    }
  ) {
    this.device = device;
    this.context = {
      solar: context?.solar ?? this.fallbackSolarFromDevice(),
      ev: context?.ev ?? this.fallbackEvFromDevice(),
      battery: context?.battery ?? this.fallbackBatteryFromDevice(),
    };
  }

  private fallbackSolarFromDevice(): SolarArrayConfig[] {
    if (this.device.type === 'solar_array' && this.device.solar_config) {
      return [
        {
          id: this.device.id,
          panel_count: this.device.solar_config.panel_count,
          output_per_panel_kw: this.device.solar_config.output_per_panel_kw,
        },
      ];
    }
    return [];
  }

  private fallbackEvFromDevice(): EvDeviceConfig[] {
    if (this.device.type === 'ev' && this.device.ev_config) {
      return [
        {
          id: this.device.id,
          battery_capacity_kwh: this.device.ev_config.battery_capacity_kwh,
          target_charge: this.device.ev_config.target_charge,
          departure_time: this.device.ev_config.departure_time,
          charger_power_kw: this.device.ev_config.charger_power_kw,
        },
      ];
    }
    return [];
  }

  private fallbackBatteryFromDevice(): BatteryDeviceConfig | null {
    if (this.device.type === 'battery' && this.device.battery_config) {
      return {
        id: this.device.id,
        capacity_kwh: this.device.battery_config.capacity_kwh,
        max_flow_kw: this.device.battery_config.max_flow_kw,
      };
    }
    return null;
  }

  isConfigured(): boolean {
    return true;
  }

  async getStatus(): Promise<DeviceStatus> {
    const now = new Date();
    const status: DeviceStatus = {
      deviceId: this.device.id,
      providerType: 'simulated',
      timestamp: now,
      isLive: false,
    };

    switch (this.device.type) {
      case 'solar_array': {
        const cfg = this.device.solar_config;
        if (cfg) {
          const inst = computeSolarArrayInstant(
            {
              id: this.device.id,
              panel_count: cfg.panel_count,
              output_per_panel_kw: cfg.output_per_panel_kw,
            },
            now
          );
          status.solarOutputKw = inst.total_output_kw;
        }
        break;
      }
      case 'battery': {
        const cfg = this.device.battery_config;
        if (cfg) {
          const batteryCfg: BatteryDeviceConfig = {
            id: this.device.id,
            capacity_kwh: cfg.capacity_kwh,
            max_flow_kw: cfg.max_flow_kw,
          };
          const inst = computeBatteryStateAt(
            batteryCfg,
            now,
            this.context.solar,
            this.context.ev
          );
          status.batterySOCPercent = inst.soc_percent;
          status.batterySOCKwh = inst.soc_kwh;
          status.batteryPowerKw = inst.power_kw;
          status.batteryCapacityKwh = batteryCfg.capacity_kwh;
          status.batteryMaxFlowKw = batteryCfg.max_flow_kw;
          // Simulated batteries are modeled as factory-new units with full
          // capacity retention. Real provider adapters (Tesla, Enphase, …)
          // should report their own measured health value; if they don't, the
          // route surfaces null so the UI hides the metric instead of
          // showing a misleading constant.
          status.batteryHealthPct = 100;
        }
        break;
      }
      case 'ev': {
        const cfg = this.device.ev_config;
        if (cfg) {
          const evCfg: EvDeviceConfig = {
            id: this.device.id,
            battery_capacity_kwh: cfg.battery_capacity_kwh,
            target_charge: cfg.target_charge,
            departure_time: cfg.departure_time,
            charger_power_kw: cfg.charger_power_kw,
          };
          const soc = computeEvSocPercent(evCfg, now);
          // Use solar surplus available after house load
          const solar = this.context.solar.length
            ? this.context.solar.reduce((sum, c) => {
                const a = computeSolarArrayInstant(c, now);
                return sum + a.total_output_kw;
              }, 0)
            : 0;
          const surplus = Math.max(
            0,
            solar - computeHouseLoadInstant(now)
          );
          const rate = computeEvChargeRateKw(evCfg, now, surplus);
          status.evSOCPercent = soc;
          status.evChargeRateKw = rate;
          status.evPluggedIn = isOvernightWindow(now) || rate > 0;
        }
        break;
      }
      case 'house': {
        status.houseLoadKw = computeHouseLoadInstant(now);
        break;
      }
      case 'grid': {
        const flows = solveFlows(
          now,
          this.context.solar,
          this.context.ev,
          this.context.battery
        );
        status.gridImportKw = flows.grid_kw;
        status.gridCarbonIntensity = 250;
        break;
      }
    }

    return status;
  }

  async getHistory(range: HistoryRange): Promise<HistoricalPoint[]> {
    const { startDate, endDate } = range;

    switch (this.device.type) {
      case 'solar_array': {
        const cfg = this.device.solar_config;
        if (!cfg) return [];
        const devCfg: DeviceConfig = {
          id: this.device.id,
          name: this.device.name,
          type: 'solar_array',
          is_active: true,
          solar_config: cfg,
        };
        const raw = generateSolarData(startDate, endDate, [devCfg]);
        return raw.map((pt) => ({
          timestamp: new Date(pt.timestamp),
          value: pt.total_generation_kwh,
          unit: 'kWh',
        }));
      }
      case 'house': {
        const raw = generateHouseLoadData(startDate, endDate);
        return raw.map((pt) => ({
          timestamp: new Date(pt.timestamp),
          value: pt.energy_kwh,
          unit: 'kWh',
        }));
      }
      case 'battery': {
        const cfg = this.device.battery_config;
        if (!cfg) return [];
        const series = computeBatteryHistory(
          {
            id: this.device.id,
            capacity_kwh: cfg.capacity_kwh,
            max_flow_kw: cfg.max_flow_kw,
          },
          startDate,
          endDate,
          this.context.solar,
          this.context.ev
        );
        return series.map((s) => ({
          timestamp: s.timestamp,
          value:
            range.metric === 'soc_kwh'
              ? s.soc_kwh
              : range.metric === 'power_kw'
                ? s.power_kw
                : s.soc_percent,
          unit:
            range.metric === 'soc_kwh'
              ? 'kWh'
              : range.metric === 'power_kw'
                ? 'kW'
                : '%',
        }));
      }
      case 'ev': {
        const cfg = this.device.ev_config;
        if (!cfg) return [];
        const evCfg: EvDeviceConfig = {
          id: this.device.id,
          battery_capacity_kwh: cfg.battery_capacity_kwh,
          target_charge: cfg.target_charge,
          departure_time: cfg.departure_time,
          charger_power_kw: cfg.charger_power_kw,
        };
        const out: HistoricalPoint[] = [];
        const cursor = new Date(startDate);
        cursor.setMinutes(0, 0, 0);
        while (cursor <= endDate) {
          const t = new Date(cursor);
          const solar = this.context.solar.reduce(
            (s, c) => s + computeSolarArrayInstant(c, t).total_output_kw,
            0
          );
          const surplus = Math.max(0, solar - computeHouseLoadInstant(t));
          const value =
            range.metric === 'charge_kw'
              ? computeEvChargeRateKw(evCfg, t, surplus)
              : computeEvSocPercent(evCfg, t);
          out.push({
            timestamp: new Date(t),
            value,
            unit: range.metric === 'charge_kw' ? 'kW' : '%',
          });
          cursor.setHours(cursor.getHours() + 1);
        }
        return out;
      }
      case 'grid': {
        const out: HistoricalPoint[] = [];
        const cursor = new Date(startDate);
        cursor.setMinutes(0, 0, 0);
        while (cursor <= endDate) {
          const flows = solveFlows(
            new Date(cursor),
            this.context.solar,
            this.context.ev,
            this.context.battery
          );
          out.push({
            timestamp: new Date(cursor),
            value: flows.grid_kw,
            unit: 'kW',
          });
          cursor.setHours(cursor.getHours() + 1);
        }
        return out;
      }
      default:
        return [];
    }
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: true,
      message: `[Simulated] Command '${command.type}' acknowledged`,
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'simulated',
      displayName: 'Simulated (Demo)',
      description:
        'Uses built-in physics-based simulation. No real hardware required.',
      authMethod: 'none',
      fields: [],
    };
  }
}
