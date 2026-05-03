import { NextRequest, NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';
import { createClient } from '@/lib/supabase/server';
import { pickGridDevice } from '@/lib/server/system-devices';
import { getPollingConfig } from '@/lib/server/polling-config';
import { bucketAvgRate, isoHour } from '@/lib/server/adapter-flows';
import {
  estimateRangeMiles,
  timeToFull,
  offPeakWindowLabel,
  offPeakStartLabel,
  fmtClock12h,
  PRIORITY_MODE_LABEL,
  EV_EFFICIENCY_MI_PER_KWH,
} from '@/lib/simulation';
import { checkReadRateLimit } from '@/lib/api/rate-limit';
import { validateQuery } from '@/lib/api/validate';
import { z } from 'zod';

const NoQuerySchema = z.object({}).strict();

export const dynamic = 'force-dynamic';

function fmtTime(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const am = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${am}`;
}

export async function GET(req: NextRequest) {
  const result = await loadUserContext();
  if (result.error)
    return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;

  const rateLimitError = checkReadRateLimit(req, context.user.id);
  if (rateLimitError) return rateLimitError;

  const qr = validateQuery(NoQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const adapterCtx = {
    solar: context.solarConfigs,
    ev: context.evConfigs,
    battery: context.batteryConfigs[0] ?? null,
    persistConfig: context.persistConnectionConfig,
  };

  const evDevices = context.rawDevices.filter((d) => d.type === 'ev');

  // Load sync-state freshness for live EV devices so we can prefer the most
  // recently persisted ev_charge_sessions row over a live provider API call
  // when the background cron has already synced within the polling window.
  const liveEvIds = evDevices
    .filter((d) => d.provider_type !== 'simulated')
    .map((d) => d.id);

  const evSyncStateByDevice = new Map<string, { isFresh: boolean }>();
  if (liveEvIds.length > 0) {
    const supabase = await createClient();
    const { data: syncRows } = await supabase
      .from('device_sync_state')
      .select('device_id, last_success_at')
      .in('device_id', liveEvIds);
    for (const row of syncRows ?? []) {
      const lastSuccessAt = row.last_success_at ? new Date(row.last_success_at) : null;
      const providerType = evDevices.find((d) => d.id === row.device_id)?.provider_type;
      const cfg = providerType ? getPollingConfig(providerType as import('@/lib/adapters/types').ProviderType) : null;
      const isFresh =
        lastSuccessAt != null &&
        cfg != null &&
        (Date.now() - lastSuccessAt.getTime()) / 1000 <= cfg.minIntervalSec * 2;
      evSyncStateByDevice.set(row.device_id, { isFresh });
    }
  }

  // Per-vehicle current status: prefer the most recent persisted
  // ev_charge_sessions row when a fresh background sync exists.
  // This avoids redundant provider API round-trips for recently-synced vehicles.
  const getEvStatus = async (d: (typeof evDevices)[number]) => {
    const syncInfo = evSyncStateByDevice.get(d.id);
    if (syncInfo?.isFresh && d.provider_type !== 'simulated') {
      const supabase = await createClient();
      const { data: persisted } = await supabase
        .from('ev_charge_sessions')
        .select('soc_percent, plugged_in, timestamp')
        .eq('device_id', d.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      // Two-layer freshness: also validate the row's own timestamp so that
      // a stale ev_charge_sessions row (from before the sync window) is never
      // served as fresh data, even if device_sync_state.last_success_at is recent.
      // This prevents the sync_state/ingestion-write-failure skew that would
      // otherwise cause a device to appear fresh while serving stale values.
      const providerCfg = getPollingConfig(d.provider_type as import('@/lib/adapters/types').ProviderType);
      const rowFresh =
        persisted != null &&
        (Date.now() - new Date(persisted.timestamp).getTime()) / 1000 <=
          providerCfg.minIntervalSec * 2;
      if (rowFresh && persisted) {
        const evCfg = context.evConfigs.find((c) => c.id === d.id);
        // evChargeRateKw is intentionally omitted — ev_charge_sessions stores
        // only SoC and plugged state, not instantaneous charge rate. The
        // downstream consumer defaults missing rate to 0.
        return {
          deviceId: d.id,
          providerType: d.provider_type as import('@/lib/adapters/types').ProviderType,
          timestamp: new Date(persisted.timestamp),
          isLive: true,
          evSOCPercent: persisted.soc_percent ?? undefined,
          evPluggedIn: persisted.plugged_in ?? false,
          evBatteryCapacityKwh: evCfg?.battery_capacity_kwh,
        } as Awaited<ReturnType<ReturnType<typeof createAdapter>['getStatus']>>;
      }
    }
    return createAdapter(d, adapterCtx).getStatus();
  };

  // Per-vehicle 7-day charge history (used to derive last_charged_label
  // deterministically) and grid history all flow through the adapter contract.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start24h = new Date(now.getTime() - 23 * 60 * 60 * 1000);
  start24h.setMinutes(0, 0, 0);

  // Grid history is only available when the user has actually configured
  // a grid device (real or user-added simulated). With none configured we
  // skip the request and treat every hour as 0 grid_kw — the clean-energy
  // percentage degrades gracefully instead of being inflated by a
  // fabricated "all imports free" baseline.
  const gridDevice = pickGridDevice(context.rawDevices);
  const gridHistoryEmpty = Promise.resolve([] as { timestamp: Date; value: number; unit: string }[]);

  const [evStatuses, evWeekHistories, ev24hHistories, evMonthHistories, gridDayHistory, gridMonthHistory] =
    await Promise.all([
      Promise.all(evDevices.map((d) => getEvStatus(d))),
      Promise.all(
        evDevices.map((d) =>
          createAdapter(d, adapterCtx).getHistory({
            metric: 'charge_kw',
            startDate: sevenDaysAgo,
            endDate: now,
          })
        )
      ),
      Promise.all(
        evDevices.map((d) =>
          createAdapter(d, adapterCtx).getHistory({
            metric: 'charge_kw',
            startDate: start24h,
            endDate: now,
          })
        )
      ),
      Promise.all(
        evDevices.map((d) =>
          createAdapter(d, adapterCtx).getHistory({
            metric: 'charge_kw',
            startDate: monthStart,
            endDate: now,
          })
        )
      ),
      gridDevice
        ? createAdapter(gridDevice, adapterCtx).getHistory({
            metric: 'grid_kw',
            startDate: startToday,
            endDate: now,
          })
        : gridHistoryEmpty,
      gridDevice
        ? createAdapter(gridDevice, adapterCtx).getHistory({
            metric: 'grid_kw',
            startDate: monthStart,
            endDate: now,
          })
        : gridHistoryEmpty,
    ]);

  // Solar history (for clean-energy %) — fetched per solar device. We
  // bucket the per-device series into ISO-hour kWh below; doing it here
  // would lock us into one keying scheme prematurely.
  const solarDevices = context.rawDevices.filter((d) => d.type === 'solar_array');
  const solarTodayHistories = await Promise.all(
    solarDevices.map((d) =>
      createAdapter(d, adapterCtx).getHistory({
        metric: 'energy_kwh',
        startDate: startToday,
        endDate: now,
      })
    )
  );

  // Today's total EV kWh. We MUST integrate `charge_kw` over time — a raw
  // sum of sub-hourly power samples would over-count by the sample count
  // per hour (e.g. 5-minute Home Assistant samples would inflate 1h of
  // 7 kW charging from 7 kWh to ~84 kWh). The fix: per-vehicle bucket-
  // average the kW samples to one value per ISO hour, then sum across
  // vehicles per hour. Since each hour-bucket is 1h wide, the per-hour
  // kW value is also kWh-per-hour, and summing across hours yields kWh.
  const evHourlyKwhToday = new Map<string, number>();
  const perVehicleBucketsMonth = evMonthHistories.map(bucketAvgRate);
  for (const vehicleBuckets of perVehicleBucketsMonth) {
    for (const [hourKey, avgKw] of vehicleBuckets) {
      if (new Date(hourKey) < startToday) continue;
      // avgKw (kW) × 1h = kWh delivered in that hour by this vehicle.
      evHourlyKwhToday.set(hourKey, (evHourlyKwhToday.get(hourKey) ?? 0) + avgKw);
    }
  }
  const totalEvKwhToday = Array.from(evHourlyKwhToday.values()).reduce(
    (s, v) => s + v,
    0
  );

  // Clean energy share per hour: solar / (solar + grid_import). All
  // three series (EV kWh per hour above, solar kWh per hour, grid kW
  // per hour) are keyed by isoHour() so the lookups align even when
  // adapters emit sub-hourly samples.
  const solarHourlyKwh = new Map<string, number>();
  for (const series of solarTodayHistories) {
    // `energy_kwh` is additive per interval, so summing across samples
    // within an hour gives the kWh delivered that hour.
    for (const pt of series) {
      const key = isoHour(pt.timestamp);
      solarHourlyKwh.set(key, (solarHourlyKwh.get(key) ?? 0) + pt.value);
    }
  }
  // grid_kw is instantaneous; bucket-avg per hour gives kW which == kWh
  // per hour over a 1h bucket. Use the same helper as EV power.
  const gridHourlyKw = bucketAvgRate(gridDayHistory);
  let cleanEnergyKwh = 0;
  for (const [hourKey, evKwh] of evHourlyKwhToday) {
    const solar = solarHourlyKwh.get(hourKey) ?? 0;
    const gridImport = Math.max(0, gridHourlyKw.get(hourKey) ?? 0);
    const cleanShare = solar > 0 ? Math.min(1, solar / Math.max(0.001, solar + gridImport)) : 0;
    cleanEnergyKwh += evKwh * cleanShare;
  }
  const cleanEnergyPct =
    totalEvKwhToday > 0 ? Math.round((cleanEnergyKwh / totalEvKwhToday) * 100) : 0;

  function deriveLastChargedLabel(weekSeries: { timestamp: Date; value: number }[], rateNow: number): string {
    if (rateNow > 0.1) return 'Now';
    // Walk back through hourly samples to find the most recent hour with charge
    const sorted = [...weekSeries].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const last = sorted.find((p) => p.value > 0.1);
    if (!last) return '—';
    const at = last.timestamp;
    const ageMs = now.getTime() - at.getTime();
    const ageHr = ageMs / 3600000;
    if (ageHr < 1) return `${Math.max(1, Math.round(ageMs / 60000))} min ago`;
    if (at.toDateString() === now.toDateString()) return `Today ${fmtTime(at)}`;
    if (ageHr < 48) return `Yesterday ${fmtTime(at)}`;
    return `${Math.floor(ageHr / 24)} days ago`;
  }

  const vehicles = evDevices.map((d, i) => {
    const st = evStatuses[i];
    const cfg = context.evConfigs.find((c) => c.id === d.id)!;
    const soc = st.evSOCPercent ?? 0;
    const rate = st.evChargeRateKw ?? 0;
    const tt = timeToFull(soc, cfg);
    const status: 'charging' | 'completed' | 'disconnected' =
      rate > 0.1 ? 'charging' : soc >= cfg.target_charge * 100 - 0.5 ? 'completed' : 'disconnected';

    const lastChargedLabel = deriveLastChargedLabel(evWeekHistories[i], rate);
    const departureShort = fmtClock12h(String(cfg.departure_time).slice(0, 5));

    return {
      id: d.id,
      name: findDeviceName(context.rawDevices, d.id),
      battery_capacity_kwh: cfg.battery_capacity_kwh,
      target_charge_pct: cfg.target_charge * 100,
      battery_level_pct: Math.round(soc),
      range_mi: estimateRangeMiles(soc, cfg.battery_capacity_kwh),
      max_range_mi: estimateRangeMiles(100, cfg.battery_capacity_kwh),
      charging_status: status,
      plugged_in: st.evPluggedIn ?? false,
      charge_rate_kw: Math.round(rate * 100) / 100,
      time_to_full_label: tt.label,
      last_charged_label: lastChargedLabel,
      // Efficiency is the simulator's documented model constant. Real
      // adapters that compute actual mi/kWh from telemetry will report
      // their own value here.
      efficiency_mi_per_kwh: EV_EFFICIENCY_MI_PER_KWH,
      departure_time: cfg.departure_time,
      schedule_window_label: `${offPeakStartLabel()} – ${departureShort}`,
    };
  });

  // 24h chart: per-hour AVG kW per vehicle, then summed across vehicles
  // per hour. We bucket-average inside each vehicle's series to one value
  // per ISO hour first — raw-summing sub-hourly samples would inflate the
  // chart by the sample count (e.g. 12× for 5-min cadence).
  const history24h: { time: string; total_kw: number; per_vehicle: Record<string, number> }[] = [];
  const buckets = new Map<string, { total: number; perVehicle: Record<string, number> }>();
  const perVehicle24hBuckets = ev24hHistories.map(bucketAvgRate);
  for (let vi = 0; vi < evDevices.length; vi++) {
    const name = findDeviceName(context.rawDevices, evDevices[vi].id);
    for (const [hourKey, avgKw] of perVehicle24hBuckets[vi]) {
      const entry = buckets.get(hourKey) ?? { total: 0, perVehicle: {} };
      entry.total += avgKw;
      entry.perVehicle[name] = (entry.perVehicle[name] ?? 0) + avgKw;
      buckets.set(hourKey, entry);
    }
  }
  const sortedKeys = Array.from(buckets.keys()).sort();
  for (const key of sortedKeys) {
    const entry = buckets.get(key)!;
    history24h.push({
      time: fmtTime(new Date(key)),
      total_kw: Math.round(entry.total * 100) / 100,
      per_vehicle: Object.fromEntries(
        Object.entries(entry.perVehicle).map(([k, v]) => [k, Math.round(v * 100) / 100])
      ),
    });
  }

  const totalCurrentKw = vehicles.reduce((s, v) => s + v.charge_rate_kw, 0);
  const chargingCount = vehicles.filter((v) => v.charging_status === 'charging').length;

  // Month EV kWh — same per-vehicle bucket-average pattern as today.
  // The monthly buckets were pre-computed above as `perVehicleBucketsMonth`.
  // Each per-hour avg kW × 1h = kWh per hour; sum across vehicles, then
  // sum across all hours in the month.
  const evHourlyKwhMonth = new Map<string, number>();
  for (const vehicleBuckets of perVehicleBucketsMonth) {
    for (const [hourKey, avgKw] of vehicleBuckets) {
      evHourlyKwhMonth.set(hourKey, (evHourlyKwhMonth.get(hourKey) ?? 0) + avgKw);
    }
  }
  // Suppress unused-import lint for gridMonthHistory: it's reserved for
  // future cost-savings calculations that include grid carbon weighting.
  void gridMonthHistory;
  const monthEvKwh = Array.from(evHourlyKwhMonth.values()).reduce((s, v) => s + v, 0);
  const monthEvCostSavings = monthEvKwh * 0.18 * 0.18;

  return NextResponse.json({
    vehicles,
    history: history24h,
    summary: {
      current_total_kw: Math.round(totalCurrentKw * 100) / 100,
      charging_count: chargingCount,
      energy_today_kwh: Math.round(totalEvKwhToday * 10) / 10,
      cost_savings_usd: Math.round(monthEvCostSavings * 100) / 100,
      clean_energy_pct: cleanEnergyPct,
      month_energy_mwh: Math.round((monthEvKwh / 1000) * 100) / 100,
      off_peak_window_label: offPeakWindowLabel(),
      off_peak_start_label: offPeakStartLabel(),
      priority_mode_label: PRIORITY_MODE_LABEL,
    },
  });
}
