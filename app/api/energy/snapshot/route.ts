import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import {
  solveFlows,
  computeBatteryStateAt,
  computeEvSocPercent,
  computeEvChargeRateKw,
  isOvernightWindow,
  computeHouseLoadInstant,
  computeTotalSolarInstant,
  estimateRangeMiles,
} from '@/lib/simulation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await loadUserContext();
  if (result.error) return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;
  const { rawDevices, solarConfigs, batteryConfigs, evConfigs } = context;

  const now = new Date();
  const battery = batteryConfigs[0] ?? null;
  const flows = solveFlows(now, solarConfigs, evConfigs, battery);

  const solarOutputKw = computeTotalSolarInstant(solarConfigs, now);
  const houseLoadKw = computeHouseLoadInstant(now);

  const batteryState = battery
    ? computeBatteryStateAt(battery, now, solarConfigs, evConfigs)
    : null;

  const evStates = evConfigs.map((cfg) => {
    const surplus = Math.max(0, solarOutputKw - houseLoadKw);
    const soc = computeEvSocPercent(cfg, now);
    const rate = computeEvChargeRateKw(cfg, now, surplus);
    return {
      id: cfg.id,
      name: findDeviceName(rawDevices, cfg.id),
      soc_percent: Math.round(soc * 10) / 10,
      charge_rate_kw: Math.round(rate * 100) / 100,
      plugged_in: rate > 0 || isOvernightWindow(now),
      range_miles: estimateRangeMiles(soc, cfg.battery_capacity_kwh),
      max_range_miles: estimateRangeMiles(100, cfg.battery_capacity_kwh),
    };
  });

  return NextResponse.json({
    timestamp: now.toISOString(),
    flows: {
      solar_kw: Math.round(flows.solar_kw * 100) / 100,
      house_kw: Math.round(flows.house_kw * 100) / 100,
      ev_kw: Math.round(flows.ev_kw * 100) / 100,
      battery_power_kw: Math.round(flows.battery_power_kw * 100) / 100,
      battery_soc_percent: Math.round(flows.battery_soc_percent * 10) / 10,
      grid_kw: Math.round(flows.grid_kw * 100) / 100,
      edges: flows.edges.map((e) => ({
        source: e.source,
        target: e.target,
        power_kw: Math.round(e.power_kw * 100) / 100,
      })),
    },
    devices: {
      solar: { count: solarConfigs.length, current_kw: Math.round(solarOutputKw * 100) / 100 },
      battery: batteryState && battery
        ? {
            id: battery.id,
            name: findDeviceName(rawDevices, battery.id),
            capacity_kwh: battery.capacity_kwh,
            soc_percent: Math.round(batteryState.soc_percent * 10) / 10,
            soc_kwh: Math.round(batteryState.soc_kwh * 10) / 10,
            power_kw: Math.round(batteryState.power_kw * 100) / 100,
            max_flow_kw: battery.max_flow_kw,
          }
        : null,
      ev: evStates,
      house: { current_kw: Math.round(houseLoadKw * 100) / 100 },
    },
    counts: {
      solar: solarConfigs.length,
      battery: batteryConfigs.length,
      ev: evConfigs.length,
    },
  });
}
