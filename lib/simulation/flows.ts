/**
 * Solve current power flows between devices given live device states.
 * Allocation order:
 *  1. Solar -> house
 *  2. Solar -> EV (daytime)
 *  3. Solar -> battery
 *  4. Solar -> grid (export)
 * Deficits covered by battery first, then grid import.
 */

import { SolarArrayConfig, computeTotalSolarInstant } from './solar';
import { computeHouseLoadInstant } from './house';
import {
  EvDeviceConfig,
  computeEvChargeRateKw,
  isOvernightWindow,
} from './ev';
import { BatteryDeviceConfig, computeBatteryStateAt } from './battery';

export interface FlowEdge {
  source: 'solar' | 'battery' | 'grid';
  target: 'house' | 'battery' | 'ev' | 'grid';
  power_kw: number;
}

export interface SolvedFlows {
  timestamp: Date;
  solar_kw: number;
  house_kw: number;
  ev_kw: number;
  battery_power_kw: number;
  battery_soc_percent: number;
  grid_kw: number; // + import, - export
  edges: FlowEdge[];
}

export function solveFlows(
  date: Date,
  solarConfigs: SolarArrayConfig[],
  evConfigs: EvDeviceConfig[],
  batteryConfig: BatteryDeviceConfig | null
): SolvedFlows {
  const solar = computeTotalSolarInstant(solarConfigs, date);
  const house = computeHouseLoadInstant(date);

  let ev = 0;
  let surplusForEv = Math.max(0, solar - house);
  for (const cfg of evConfigs) {
    const draw = computeEvChargeRateKw(cfg, date, surplusForEv);
    ev += draw;
    surplusForEv = Math.max(0, surplusForEv - draw);
  }

  let batterySoc = 50;
  let batteryPower = 0;
  if (batteryConfig) {
    const state = computeBatteryStateAt(
      batteryConfig,
      date,
      solarConfigs,
      evConfigs
    );
    batterySoc = state.soc_percent;
    batteryPower = state.power_kw;
  }

  const edges: FlowEdge[] = [];
  let solarRemaining = solar;
  let houseRemaining = house;
  let evRemaining = ev;

  // 1. Solar -> House
  const solarToHouse = Math.min(solarRemaining, houseRemaining);
  if (solarToHouse > 0.05) {
    edges.push({ source: 'solar', target: 'house', power_kw: solarToHouse });
  }
  solarRemaining -= solarToHouse;
  houseRemaining -= solarToHouse;

  // 2. Solar -> EV (only daytime)
  if (!isOvernightWindow(date)) {
    const solarToEv = Math.min(solarRemaining, evRemaining);
    if (solarToEv > 0.05) {
      edges.push({ source: 'solar', target: 'ev', power_kw: solarToEv });
    }
    solarRemaining -= solarToEv;
    evRemaining -= solarToEv;
  }

  // 3. Battery interaction
  if (batteryPower > 0.05) {
    let batteryNeed = batteryPower;
    const solarToBattery = Math.min(solarRemaining, batteryNeed);
    if (solarToBattery > 0.05) {
      edges.push({
        source: 'solar',
        target: 'battery',
        power_kw: solarToBattery,
      });
    }
    solarRemaining -= solarToBattery;
    batteryNeed -= solarToBattery;
    if (batteryNeed > 0.05) {
      edges.push({ source: 'grid', target: 'battery', power_kw: batteryNeed });
    }
  } else if (batteryPower < -0.05) {
    let available = -batteryPower;
    const battToHouse = Math.min(available, houseRemaining);
    if (battToHouse > 0.05) {
      edges.push({
        source: 'battery',
        target: 'house',
        power_kw: battToHouse,
      });
    }
    available -= battToHouse;
    houseRemaining -= battToHouse;
    const battToEv = Math.min(available, evRemaining);
    if (battToEv > 0.05) {
      edges.push({ source: 'battery', target: 'ev', power_kw: battToEv });
    }
    available -= battToEv;
    evRemaining -= battToEv;
  }

  // 4. Grid covers remaining loads
  if (houseRemaining > 0.05) {
    edges.push({ source: 'grid', target: 'house', power_kw: houseRemaining });
  }
  if (evRemaining > 0.05) {
    edges.push({ source: 'grid', target: 'ev', power_kw: evRemaining });
  }

  // 5. Solar export
  if (solarRemaining > 0.05) {
    edges.push({ source: 'solar', target: 'grid', power_kw: solarRemaining });
  }

  const gridImport = edges
    .filter((e) => e.source === 'grid')
    .reduce((s, e) => s + e.power_kw, 0);
  const gridExport = edges
    .filter((e) => e.target === 'grid')
    .reduce((s, e) => s + e.power_kw, 0);
  const grid_kw = gridImport - gridExport;

  return {
    timestamp: date,
    solar_kw: solar,
    house_kw: house,
    ev_kw: ev,
    battery_power_kw: batteryPower,
    battery_soc_percent: batterySoc,
    grid_kw,
    edges,
  };
}

export function solveFlowsHistory(
  startDate: Date,
  endDate: Date,
  solarConfigs: SolarArrayConfig[],
  evConfigs: EvDeviceConfig[],
  batteryConfig: BatteryDeviceConfig | null
): SolvedFlows[] {
  const out: SolvedFlows[] = [];
  const cursor = new Date(startDate);
  cursor.setMinutes(0, 0, 0);
  while (cursor <= endDate) {
    out.push(
      solveFlows(new Date(cursor), solarConfigs, evConfigs, batteryConfig)
    );
    cursor.setHours(cursor.getHours() + 1);
  }
  return out;
}
