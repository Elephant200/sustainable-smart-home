import { NextResponse } from 'next/server';
import { loadUserContext, findDeviceName } from '@/lib/server/device-context';
import { createAdapter } from '@/lib/adapters/factory';
import { pickGridDevice, pickHouseDevice } from '@/lib/server/system-devices';
import { estimateRangeMiles } from '@/lib/simulation';
import { allocateFlowEdges } from '@/lib/simulation/flows';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await loadUserContext();
  if (result.error) return NextResponse.json(result.error.body, { status: result.error.status });
  const { context } = result;
  const { rawDevices, solarConfigs, batteryConfigs, evConfigs, user } = context;

  const adapterCtx = {
    solar: solarConfigs,
    ev: evConfigs,
    battery: batteryConfigs[0] ?? null,
    persistConfig: context.persistConnectionConfig,
  };

  const solarDevices = rawDevices.filter((d) => d.type === 'solar_array');
  const batteryDevices = rawDevices.filter((d) => d.type === 'battery');
  const evDevices = rawDevices.filter((d) => d.type === 'ev');
  const houseDevice = pickHouseDevice(rawDevices);
  const gridDevice = pickGridDevice(rawDevices);

  // Per-device current state through the adapter layer (so a real provider
  // swap is a one-file change in lib/adapters/providers/*). House and grid
  // are skipped entirely when the user hasn't added one — the response
  // exposes `null` for those roles so the dashboard can prompt the user to
  // configure one in Settings instead of showing a fabricated value.
  void user;
  const [solarStatuses, batteryStatuses, evStatuses, gridStatus, houseStatus] =
    await Promise.all([
      Promise.all(solarDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
      Promise.all(batteryDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
      Promise.all(evDevices.map((d) => createAdapter(d, adapterCtx).getStatus())),
      gridDevice
        ? createAdapter(gridDevice, adapterCtx).getStatus()
        : Promise.resolve(null),
      houseDevice
        ? createAdapter(houseDevice, adapterCtx).getStatus()
        : Promise.resolve(null),
    ]);

  const solarOutputKw = solarStatuses.reduce(
    (s, st) => s + (st.solarOutputKw ?? 0),
    0
  );

  // House load source preference (no simulator fallback — per product
  // rule the simulator is only used when the user has *explicitly* added a
  // simulated device, which surfaces here as a populated `houseLoadKw` on
  // the SimulatedAdapter status; we therefore gate on the value being
  // present rather than `isLive`, since SimulatedAdapter intentionally
  // reports `isLive:false` for honesty even when its values are valid):
  //   1. A house adapter that reported a value (real-live OR explicitly
  //      simulated).
  //   2. A real grid adapter that also reports LOAD (SolarEdge, Tesla).
  //   3. 0 — UI shows an empty state pointing at Settings.
  let houseLoadKw = 0;
  if (houseStatus && houseStatus.houseLoadKw != null) {
    houseLoadKw = houseStatus.houseLoadKw;
  } else if (gridStatus?.houseLoadKwSystem != null) {
    houseLoadKw = gridStatus.houseLoadKwSystem;
  }

  const battery = batteryConfigs[0] ?? null;
  const batteryStatus = batteryStatuses[0];

  // Aggregate EV charge rate from per-vehicle adapter statuses
  const evStates = evDevices.map((d, i) => {
    const st = evStatuses[i];
    const cfg = evConfigs.find((c) => c.id === d.id)!;
    const soc = st.evSOCPercent ?? 0;
    const rate = st.evChargeRateKw ?? 0;
    return {
      id: d.id,
      name: findDeviceName(rawDevices, d.id),
      soc_percent: Math.round(soc * 10) / 10,
      charge_rate_kw: Math.round(rate * 100) / 100,
      plugged_in: st.evPluggedIn ?? false,
      range_miles: estimateRangeMiles(soc, cfg.battery_capacity_kwh),
      max_range_miles: estimateRangeMiles(100, cfg.battery_capacity_kwh),
    };
  });

  const evKw = evStates.reduce((s, e) => s + e.charge_rate_kw, 0);
  const batteryPowerKw = batteryStatus?.batteryPowerKw ?? 0;
  const batterySocPercent = batteryStatus?.batterySOCPercent ?? 0;

  const now = new Date();

  // Compute flow edges + signed grid_kw centrally from the per-class
  // values we just gathered. We never trust adapter-supplied flowEdges
  // (real providers don't populate them) and we never trust gridImportKw
  // alone (it would not balance the rest of the snapshot under battery
  // discharge or solar export). Running the same allocator that
  // solveFlowsHistoryFromAdapters uses keeps every dashboard view
  // consistent with itself.
  const { grid_kw, edges } = allocateFlowEdges(
    {
      solar_kw: solarOutputKw,
      house_kw: houseLoadKw,
      ev_kw: evKw,
      battery_power_kw: batteryPowerKw,
      battery_soc_percent: batterySocPercent,
    },
    now
  );

  return NextResponse.json({
    timestamp: now.toISOString(),
    flows: {
      solar_kw: Math.round(solarOutputKw * 100) / 100,
      house_kw: Math.round(houseLoadKw * 100) / 100,
      ev_kw: Math.round(evKw * 100) / 100,
      battery_power_kw: Math.round(batteryPowerKw * 100) / 100,
      battery_soc_percent: Math.round(batterySocPercent * 10) / 10,
      grid_kw: Math.round(grid_kw * 100) / 100,
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        power_kw: Math.round(e.power_kw * 100) / 100,
      })),
    },
    devices: {
      solar: { count: solarConfigs.length, current_kw: Math.round(solarOutputKw * 100) / 100 },
      battery: batteryStatus && battery
        ? {
            id: battery.id,
            name: findDeviceName(rawDevices, battery.id),
            capacity_kwh: batteryStatus.batteryCapacityKwh ?? battery.capacity_kwh,
            soc_percent: Math.round((batteryStatus.batterySOCPercent ?? 0) * 10) / 10,
            soc_kwh: Math.round((batteryStatus.batterySOCKwh ?? 0) * 10) / 10,
            power_kw: Math.round((batteryStatus.batteryPowerKw ?? 0) * 100) / 100,
            max_flow_kw: batteryStatus.batteryMaxFlowKw ?? battery.max_flow_kw,
          }
        : null,
      ev: evStates,
      house: houseDevice || gridStatus?.houseLoadKwSystem != null
        ? { current_kw: Math.round(houseLoadKw * 100) / 100 }
        : null,
      grid: gridDevice ? { current_kw: Math.round((gridStatus?.gridImportKw ?? 0) * 100) / 100 } : null,
    },
    counts: {
      solar: solarConfigs.length,
      battery: batteryConfigs.length,
      ev: evConfigs.length,
    },
  });
}
