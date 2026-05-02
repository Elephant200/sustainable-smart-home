/**
 * Adapter-driven flow history.
 *
 * Assembles per-hour `SolvedFlows[]` snapshots from the device adapters'
 * `getHistory()` outputs and feeds them through the pure flow allocator
 * (`allocateFlowEdges`) so the resulting series is interchangeable with
 * `solveFlowsHistory`.
 *
 * **Simulator policy.** The simulator is only ever invoked when the user
 * has explicitly added a device with `provider_type === 'simulated'`
 * (handled inside `SimulatedAdapter`). This module never falls back to the
 * simulator for roles that the user hasn't configured at all — those roles
 * contribute zero, and the calling route is expected to expose an empty
 * state that points the user at Settings. A real-provider device whose
 * history call returns `[]` (outage, unsupported metric, auth failure)
 * also contributes zero, so the dashboard surfaces the gap rather than
 * masking it with fabricated values.
 */

import { createAdapter, type AdapterContext } from '@/lib/adapters/factory';
import type { DeviceRecord, HistoricalPoint } from '@/lib/adapters/types';
import {
  allocateFlowEdges,
  type SolvedFlows,
} from '@/lib/simulation/flows';
import type { SolarArrayConfig } from '@/lib/simulation/solar';
import type { EvDeviceConfig } from '@/lib/simulation/ev';
import type { BatteryDeviceConfig } from '@/lib/simulation/battery';
import { pickHouseDevice, pickGridDevice } from '@/lib/server/system-devices';

interface FlowsContext {
  userId: string;
  rawDevices: DeviceRecord[];
  solarConfigs: SolarArrayConfig[];
  evConfigs: EvDeviceConfig[];
  batteryConfigs: BatteryDeviceConfig[];
  persistConfig?: AdapterContext['persistConfig'];
}

/**
 * Floor a Date to the start of its UTC hour and return its ISO string.
 * Exported for downstream routes that need to align live-adapter samples
 * to the same hourly buckets the flow solver uses (e.g. the EV route's
 * energy/clean-energy accounting).
 */
export function isoHour(d: Date): string {
  const hour = new Date(d);
  hour.setMinutes(0, 0, 0);
  return hour.toISOString();
}

/**
 * Bucket a per-device cumulative-energy series (kWh delivered in each
 * sample interval) into a Map<isoHour, kWh>, summing samples that fall in
 * the same hour. Use ONLY for energy-flow metrics where each sample is an
 * additive delta (e.g. solar `energy_kwh`).
 */
function bucketSumEnergy(series: HistoricalPoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const pt of series) {
    const k = isoHour(pt.timestamp);
    m.set(k, (m.get(k) ?? 0) + pt.value);
  }
  return m;
}

/**
 * Bucket an instantaneous-state series (SoC, instantaneous power, charge
 * rate) into a Map<isoHour, value> taking the LAST sample within each hour.
 * This is the correct aggregation for non-additive metrics — providers
 * (Enphase, SolarEdge, Emporia) commonly return 1- or 15-minute samples,
 * and summing them would 4–60x the real value.
 */
function bucketLastInstant(series: HistoricalPoint[]): Map<string, number> {
  const latestTs = new Map<string, number>();
  const value = new Map<string, number>();
  for (const pt of series) {
    const k = isoHour(pt.timestamp);
    const ts = pt.timestamp.getTime();
    const prev = latestTs.get(k);
    if (prev === undefined || ts >= prev) {
      latestTs.set(k, ts);
      value.set(k, pt.value);
    }
  }
  return value;
}

/**
 * Bucket an instantaneous-rate series (kW) into hour buckets by averaging
 * samples that land in the same hour. Used for charge_kw / power_kw where
 * summing within one device would double-count sub-hourly samples (a 7 kW
 * charger sampled every 5 minutes for one hour summed would read 84
 * "kWh" instead of 7 kWh). Once bucketed to one value per hour, kW × 1h
 * = kWh, so callers can sum the resulting per-hour values to get total
 * energy. Exported for use in routes that consume `charge_kw` /
 * `power_kw` histories (e.g. the EV route's daily / monthly totals).
 */
export function bucketAvgRate(series: HistoricalPoint[]): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const pt of series) {
    const k = isoHour(pt.timestamp);
    sums.set(k, (sums.get(k) ?? 0) + pt.value);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out = new Map<string, number>();
  for (const [k, sum] of sums) {
    const c = counts.get(k) ?? 1;
    out.set(k, sum / c);
  }
  return out;
}

/**
 * Build per-hour SolvedFlows[] from adapter-driven histories. For each
 * device class we sum the live adapter readings; if no real device is
 * configured for a class the value contributes zero (no simulator
 * fallback). The same is true for a configured real device whose history
 * call returned `[]` for an hour — that hour stays at zero so the user
 * can see an outage instead of a fabricated curve.
 *
 * Battery `power_kw` is taken from the adapter when reported; otherwise
 * it is derived from the SoC-kWh delta between **two adjacent live
 * buckets**. If the previous or current SoC bucket is missing we leave
 * `power_kw` at zero rather than emitting a spurious spike (a `null →
 * value` transition would otherwise look like a giant charge event).
 */
export async function solveFlowsHistoryFromAdapters(
  startDate: Date,
  endDate: Date,
  context: FlowsContext
): Promise<SolvedFlows[]> {
  const adapterCtx: AdapterContext = {
    solar: context.solarConfigs,
    ev: context.evConfigs,
    battery: context.batteryConfigs[0] ?? null,
    persistConfig: context.persistConfig,
  };

  const solarDevices = context.rawDevices.filter((d) => d.type === 'solar_array');
  const batteryDevices = context.rawDevices.filter((d) => d.type === 'battery');
  const evDevices = context.rawDevices.filter((d) => d.type === 'ev');
  const houseDevice = pickHouseDevice(context.rawDevices);

  const range = { startDate, endDate };

  const [
    solarSeriesByDevice,
    houseSeries,
    evSeriesByDevice,
    batterySocSeriesByDevice,
    batteryPowerSeriesByDevice,
  ] = await Promise.all([
    Promise.all(
      solarDevices.map((d) =>
        createAdapter(d, adapterCtx).getHistory({ ...range, metric: 'energy_kwh' })
      )
    ),
    houseDevice
      ? createAdapter(houseDevice, adapterCtx).getHistory({
          ...range,
          metric: 'energy_kwh',
        })
      : Promise.resolve([] as HistoricalPoint[]),
    Promise.all(
      evDevices.map((d) =>
        createAdapter(d, adapterCtx).getHistory({ ...range, metric: 'charge_kw' })
      )
    ),
    Promise.all(
      batteryDevices.map((d) =>
        createAdapter(d, adapterCtx).getHistory({ ...range, metric: 'soc_kwh' })
      )
    ),
    Promise.all(
      batteryDevices.map((d) =>
        createAdapter(d, adapterCtx).getHistory({ ...range, metric: 'power_kw' })
      )
    ),
  ]);

  // Aggregation rules differ by metric:
  //  - solar/house energy_kwh: sum sub-hourly samples (additive deltas)
  //  - ev charge_kw:           average sub-hourly samples (instantaneous kW)
  //  - battery soc_kwh:        last value per hour (level snapshot)
  //  - battery power_kw:       average sub-hourly samples (instantaneous kW)
  const solarBuckets = solarSeriesByDevice.map(bucketSumEnergy);
  const houseBuckets = bucketSumEnergy(houseSeries);
  const evBuckets = evSeriesByDevice.map(bucketAvgRate);
  const socBuckets = batterySocSeriesByDevice.map(bucketLastInstant);
  const powerBuckets = batteryPowerSeriesByDevice.map(bucketAvgRate);

  // Walk hourly cursor across [startDate, endDate].
  const out: SolvedFlows[] = [];
  const cursor = new Date(startDate);
  cursor.setMinutes(0, 0, 0);
  // `prevSocSum` is null until we observe a bucket where ALL configured
  // batteries report a SoC sample. This prevents `0 - prev` (or `value -
  // 0`) from being interpreted as a giant charge/discharge event when one
  // battery momentarily drops a sample.
  let prevSocSum: number | null = null;

  while (cursor <= endDate) {
    const k = cursor.toISOString();

    // Solar: sum live readings; no real device → 0.
    const solarKw = solarDevices.length > 0
      ? solarBuckets.reduce((s, m) => s + (m.get(k) ?? 0), 0)
      : 0;

    // House: live reading or 0. Real-provider outages stay at 0 (no
    // simulator fallback). When the user has no house device at all,
    // the route is expected to surface an empty state pointing at
    // Settings.
    const houseKw = houseBuckets.get(k) ?? 0;

    // EV: sum live charge_kw; no real device → 0.
    const evKw = evDevices.length > 0
      ? evBuckets.reduce((s, m) => s + (m.get(k) ?? 0), 0)
      : 0;

    // Battery: prefer adapter-reported power_kw. Fall back to SoC-delta
    // ONLY when this hour AND the previous hour each have a SoC sample
    // from every configured battery (so the delta is meaningful).
    let batteryPower = 0;
    let batterySoc = 0;
    if (batteryDevices.length > 0) {
      const liveCap = context.batteryConfigs.reduce(
        (s, c) => s + c.capacity_kwh,
        0
      );
      const allSocPresent = socBuckets.every((m) => m.has(k));
      const liveSocSum = allSocPresent
        ? socBuckets.reduce((s, m) => s + (m.get(k) as number), 0)
        : null;
      batterySoc =
        liveSocSum != null && liveCap > 0 ? (liveSocSum / liveCap) * 100 : 0;

      const livePowerSum = powerBuckets.reduce(
        (s, m) => s + (m.get(k) ?? 0),
        0
      );
      if (Math.abs(livePowerSum) > 0.001) {
        batteryPower = livePowerSum;
      } else if (liveSocSum != null && prevSocSum != null) {
        // 1-hour buckets → kW = ΔkWh / 1h. Only safe when BOTH the
        // current and previous buckets are real live samples; mixing
        // a missing bucket (0) with a present one would inject a fake
        // multi-kW spike.
        batteryPower = liveSocSum - prevSocSum;
      }
      // Advance prev only when we got a complete current bucket; a missing
      // bucket should not "freeze" the next iteration's delta against a
      // stale value either.
      if (liveSocSum != null) prevSocSum = liveSocSum;
      else prevSocSum = null;
    }

    const snapshot = {
      solar_kw: solarKw,
      house_kw: houseKw,
      ev_kw: evKw,
      battery_power_kw: batteryPower,
      battery_soc_percent: batterySoc,
    };
    const { grid_kw, edges } = allocateFlowEdges(snapshot, cursor);
    out.push({
      timestamp: new Date(cursor),
      ...snapshot,
      grid_kw,
      edges,
    });

    cursor.setHours(cursor.getHours() + 1);
  }

  return out;
}

/**
 * Build a single "current" flow snapshot from per-device live `getStatus()`
 * calls (NOT from history). Routes that need a `solveFlows`-shaped instant —
 * Analytics, Alerts, Solar — get the freshest possible reading this way:
 *
 *   - Providers like Tesla EV that don't expose a per-hour history series
 *     (`getHistory()` returns []) still report real `getStatus()` values, so
 *     "current" panels reflect the live state instead of collapsing to 0.
 *   - Sub-hourly state changes (battery flipping from charge to discharge,
 *     EV plugging in mid-hour) appear immediately, not after the next
 *     hour-bucket boundary.
 *
 * Per-role behavior matches /api/energy/snapshot exactly. The simulator is
 * only invoked when the user has explicitly configured a simulated device
 * for a role (handled inside `SimulatedAdapter`); roles with no device at
 * all contribute 0 and the calling page should surface an empty state.
 * A real device whose `getStatus()` failed (`isLive: false`) likewise
 * contributes 0 — never a fabricated value.
 */
export async function solveCurrentFlowFromAdapters(
  context: FlowsContext
): Promise<SolvedFlows> {
  const now = new Date();

  const adapterCtx: AdapterContext = {
    solar: context.solarConfigs,
    ev: context.evConfigs,
    battery: context.batteryConfigs[0] ?? null,
    persistConfig: context.persistConfig,
  };

  const solarDevices = context.rawDevices.filter((d) => d.type === 'solar_array');
  const batteryDevices = context.rawDevices.filter((d) => d.type === 'battery');
  const evDevices = context.rawDevices.filter((d) => d.type === 'ev');
  const houseDevice = pickHouseDevice(context.rawDevices);
  const gridDevice = pickGridDevice(context.rawDevices);

  const [solarStatuses, batteryStatuses, evStatuses, houseStatus, gridStatus] =
    await Promise.all([
      Promise.all(solarDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
      Promise.all(batteryDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
      Promise.all(evDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
      houseDevice
        ? createAdapter(houseDevice, adapterCtx).getStatus()
        : Promise.resolve(null),
      gridDevice
        ? createAdapter(gridDevice, adapterCtx).getStatus()
        : Promise.resolve(null),
    ]);

  const solarKw = solarStatuses.reduce((s, st) => s + (st.solarOutputKw ?? 0), 0);
  const evKw = evStatuses.reduce((s, st) => s + (st.evChargeRateKw ?? 0), 0);

  let batteryPowerKw = 0;
  let batterySocPercent = 0;
  if (batteryStatuses[0]) {
    batteryPowerKw = batteryStatuses[0].batteryPowerKw ?? 0;
    batterySocPercent = batteryStatuses[0].batterySOCPercent ?? 0;
  }

  // House preference (matches /api/energy/snapshot). We gate on the value
  // being present, not `isLive`, because SimulatedAdapter intentionally
  // reports `isLive: false` even when populating valid simulated values —
  // gating on isLive would silently drop user-added simulated house
  // devices to 0.
  //   1. House adapter reported a value (real-live OR explicit simulated).
  //   2. Real grid adapter's reported system load.
  //   3. 0 (no implicit simulator fallback).
  let houseKw = 0;
  if (houseStatus && houseStatus.houseLoadKw != null) {
    houseKw = houseStatus.houseLoadKw;
  } else if (gridStatus?.houseLoadKwSystem != null) {
    houseKw = gridStatus.houseLoadKwSystem;
  }

  const { grid_kw, edges } = allocateFlowEdges(
    {
      solar_kw: solarKw,
      house_kw: houseKw,
      ev_kw: evKw,
      battery_power_kw: batteryPowerKw,
      battery_soc_percent: batterySocPercent,
    },
    now
  );

  return {
    timestamp: now,
    solar_kw: solarKw,
    house_kw: houseKw,
    ev_kw: evKw,
    battery_power_kw: batteryPowerKw,
    battery_soc_percent: batterySocPercent,
    grid_kw,
    edges,
  };
}
