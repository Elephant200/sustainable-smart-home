/**
 * Pure deterministic battery state-of-charge model.
 * Simulates from a stable midnight baseline (40% SOC) hour-by-hour, applying
 * solar surplus / household deficit. <= 24 iterations per query.
 */

import { computeTotalSolarInstant, SolarArrayConfig } from './solar';
import { computeHouseLoadInstant } from './house';
import {
  EvDeviceConfig,
  computeEvChargeRateKw,
  isOvernightWindow,
} from './ev';

export interface BatteryDeviceConfig {
  id: string;
  capacity_kwh: number;
  max_flow_kw: number;
}

export interface BatteryInstantState {
  soc_percent: number;
  soc_kwh: number;
  power_kw: number; // positive = charging, negative = discharging
}

const STARTING_SOC_FRACTION = 0.4;
const RESERVE_FRACTION = 0.15;

function stepBattery(
  prevSocKwh: number,
  cfg: BatteryDeviceConfig,
  netSurplusKw: number
): { socKwh: number; powerKw: number } {
  let powerKw: number;
  if (netSurplusKw >= 0) {
    powerKw = Math.min(netSurplusKw, cfg.max_flow_kw);
    const remainingCapacity = cfg.capacity_kwh - prevSocKwh;
    powerKw = Math.min(powerKw, remainingCapacity);
    powerKw = Math.max(0, powerKw);
  } else {
    powerKw = Math.max(netSurplusKw, -cfg.max_flow_kw);
    const reserveKwh = RESERVE_FRACTION * cfg.capacity_kwh;
    const drawableKwh = Math.max(0, prevSocKwh - reserveKwh);
    powerKw = Math.max(powerKw, -drawableKwh);
    powerKw = Math.min(0, powerKw);
  }
  return { socKwh: prevSocKwh + powerKw, powerKw };
}

export function computeBatteryStateAt(
  cfg: BatteryDeviceConfig,
  date: Date,
  solarConfigs: SolarArrayConfig[],
  evConfigs: EvDeviceConfig[]
): BatteryInstantState {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  let socKwh = STARTING_SOC_FRACTION * cfg.capacity_kwh;
  let lastPowerKw = 0;

  const targetHours = date.getHours() + date.getMinutes() / 60;
  for (let h = 0; h <= Math.floor(targetHours); h++) {
    const t = new Date(midnight);
    t.setHours(h);
    const solar = computeTotalSolarInstant(solarConfigs, t);
    const house = computeHouseLoadInstant(t);
    const surplusBeforeEv = solar - house;
    let evDraw = 0;
    for (const ev of evConfigs) {
      evDraw += computeEvChargeRateKw(
        ev,
        t,
        Math.max(0, surplusBeforeEv - evDraw)
      );
    }
    const netForBattery = isOvernightWindow(t)
      ? solar - house
      : solar - house - evDraw;
    const result = stepBattery(socKwh, cfg, netForBattery);
    socKwh = result.socKwh;
    lastPowerKw = result.powerKw;
  }

  const socPct = Math.min(100, Math.max(0, (socKwh / cfg.capacity_kwh) * 100));
  return { soc_percent: socPct, soc_kwh: socKwh, power_kw: lastPowerKw };
}

export function computeBatteryHistory(
  cfg: BatteryDeviceConfig,
  startDate: Date,
  endDate: Date,
  solarConfigs: SolarArrayConfig[],
  evConfigs: EvDeviceConfig[]
): { timestamp: Date; soc_percent: number; soc_kwh: number; power_kw: number }[] {
  const out: { timestamp: Date; soc_percent: number; soc_kwh: number; power_kw: number }[] = [];
  const cursor = new Date(startDate);
  cursor.setMinutes(0, 0, 0);
  while (cursor <= endDate) {
    const state = computeBatteryStateAt(cfg, cursor, solarConfigs, evConfigs);
    out.push({
      timestamp: new Date(cursor),
      soc_percent: state.soc_percent,
      soc_kwh: state.soc_kwh,
      power_kw: state.power_kw,
    });
    cursor.setHours(cursor.getHours() + 1);
  }
  return out;
}

export function timeToFullHours(
  cfg: BatteryDeviceConfig,
  state: BatteryInstantState
): number {
  if (state.power_kw <= 0.05) return 0;
  const remainingKwh = cfg.capacity_kwh - state.soc_kwh;
  return remainingKwh / state.power_kw;
}
