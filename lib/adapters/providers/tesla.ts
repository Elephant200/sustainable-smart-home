/**
 * Tesla Fleet API Adapter
 *
 * Real API reference: https://developer.tesla.com/docs/fleet-api
 *
 * Auth: OAuth2 PKCE flow
 *   - Authorization URL: https://auth.tesla.com/oauth2/v3/authorize
 *   - Token URL:         https://auth.tesla.com/oauth2/v3/token
 *   - Scopes required:   energy_device_data, vehicle_device_data, openid, offline_access
 *
 * Endpoints used:
 *   GET /api/1/energy_sites/:site_id/live_status
 *     -> solar_power (W), battery_power (W), load_power (W), grid_power (W),
 *        percentage_charged, energy_left, total_pack_energy
 *   GET /api/1/energy_sites/:site_id/history?kind=power|energy|soe&period=day
 *   GET /api/1/vehicles/:vehicle_id/vehicle_data
 *     -> charge_state: { battery_level, charge_rate, charging_state }
 *
 * connection_config shape:
 *   { access_token: string; refresh_token: string; site_id: string;
 *     vehicle_id?: string; client_id?: string; region?: 'na' | 'eu' | 'cn';
 *     expires_at?: number /* unix seconds *\/ }
 *
 * Note: a raw `base_url` is intentionally NOT honored from connection_config
 * (would be SSRF / token-exfil risk). Only the `region` enum maps to one of
 * Tesla's three published Fleet API hosts (TESLA_FLEET_HOSTS allowlist).
 */

import {
  CredentialPersister,
  DeviceAdapter,
  DeviceCommand,
  DeviceRecord,
  DeviceStatus,
  HistoricalPoint,
  HistoryRange,
  ConnectionSchema,
  hasStoredCredentials,
} from '../types';
import { createLogger } from '@/lib/logger';

const log = createLogger({ provider: 'tesla' });

interface TeslaConnectionConfig {
  access_token?: string;
  refresh_token?: string;
  site_id?: string;
  vehicle_id?: string;
  // 17-character VIN. Tesla's status endpoint
  // (/api/1/vehicles/:vehicle_id/vehicle_data) keys on the numeric
  // vehicle_id, but the charging-history endpoint
  // (/api/1/dx/vehicles/charging/history) keys on VIN. Stored
  // separately so users can opt into history without re-typing the
  // numeric id.
  vin?: string;
  client_id?: string;
  expires_at?: number;
}

/**
 * Tesla Fleet API regional endpoints. Tesla publishes a small fixed list,
 * so we hardcode them here rather than honor a user-supplied `base_url`
 * from `connection_config` (which would let a malicious device row send
 * the bearer access_token to any host — SSRF / token exfiltration).
 */
const TESLA_FLEET_HOSTS: ReadonlySet<string> = new Set([
  'fleet-api.prd.na.vn.cloud.tesla.com', // North America / APAC
  'fleet-api.prd.eu.vn.cloud.tesla.com', // Europe / Middle East / Africa
  'fleet-api.prd.cn.vn.cloud.tesla.cn',  // China
]);

interface LiveStatusResponse {
  response: {
    solar_power?: number;
    battery_power?: number;
    load_power?: number;
    grid_power?: number;
    percentage_charged?: number;
    energy_left?: number;
    total_pack_energy?: number;
    timestamp?: string;
  };
}

interface PowerHistoryPoint {
  timestamp: string;
  solar_power?: number;
  battery_power?: number;
  load_power?: number;
  grid_power?: number;
}

interface VehicleDataResponse {
  response: {
    charge_state?: {
      battery_level?: number;
      charge_rate?: number; // miles/hr — convert via charger_power
      charger_power?: number; // kW
      charging_state?: string; // "Charging" | "Disconnected" | ...
    };
  };
}

const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_BASE = 'https://fleet-api.prd.na.vn.cloud.tesla.com';
const TOKEN_URL = 'https://auth.tesla.com/oauth2/v3/token';

export class TeslaAdapter implements DeviceAdapter {
  readonly providerType = 'tesla' as const;
  private device: DeviceRecord;
  private persister?: CredentialPersister;
  private inMemoryConfig: TeslaConnectionConfig;

  constructor(device: DeviceRecord, persister?: CredentialPersister) {
    this.device = device;
    this.persister = persister;
    this.inMemoryConfig = { ...(device.connection_config as TeslaConnectionConfig) };
  }

  isConfigured(): boolean {
    // Tesla devices come in two flavors with disjoint required fields:
    //   - Energy site devices (solar, battery, grid, house) read from
    //     /api/1/energy_sites/:site_id/* and need `site_id`.
    //   - Vehicle devices (EVs) read from /api/1/vehicles/:vehicle_id/*
    //     and need `vehicle_id`.
    // Requiring both would block EV-only Tesla setups (which never own a
    // Powerwall site_id) from ever being considered configured.
    const required: string[] = ['access_token'];
    if (this.device.type === 'ev') required.push('vehicle_id');
    else required.push('site_id');
    return hasStoredCredentials(this.device.connection_config, required);
  }

  /**
   * Resolve the Fleet API host. We accept an optional `region` field
   * ("na" | "eu" | "cn") in connection_config but never accept a raw URL —
   * `connection_config.base_url` is intentionally ignored. Anything else
   * returns the NA default. The bearer access_token only ever leaves the
   * server bound for the allowlist above.
   */
  private base(): string {
    const c = this.inMemoryConfig as TeslaConnectionConfig & { region?: string };
    const region = (c.region ?? 'na').toLowerCase();
    let host: string;
    switch (region) {
      case 'eu':
        host = 'fleet-api.prd.eu.vn.cloud.tesla.com';
        break;
      case 'cn':
        host = 'fleet-api.prd.cn.vn.cloud.tesla.cn';
        break;
      default:
        host = 'fleet-api.prd.na.vn.cloud.tesla.com';
    }
    if (!TESLA_FLEET_HOSTS.has(host)) host = DEFAULT_BASE.replace(/^https:\/\//, '');
    return `https://${host}`;
  }

  /**
   * Returns an "unavailable" status with no data fields populated when the
   * live Tesla call fails or credentials are missing. Real-provider devices
   * MUST NEVER fall back to simulator output (per project rules); routes /
   * UI surface `isLive=false` and the `error` reason so users see the
   * outage instead of a fabricated value.
   */
  private unavailableStatus(reason: string): DeviceStatus {
    if (reason)
      log.warn('live data unavailable', { device_id: this.device.id, device_name: this.device.name, reason });
    return {
      deviceId: this.device.id,
      providerType: 'tesla',
      timestamp: new Date(),
      isLive: false,
      error: reason || 'Tesla credentials not configured',
    };
  }

  /**
   * Exchange the refresh_token for a new access_token. Returns the new token
   * or throws on failure. Persists the rotated tokens via the configured
   * persister so subsequent requests don't repeat the refresh.
   */
  private async refreshAccessToken(): Promise<string> {
    const cfg = this.inMemoryConfig;
    if (!cfg.refresh_token) {
      throw new Error('No refresh_token available for token refresh');
    }
    const clientId = cfg.client_id ?? process.env.TESLA_CLIENT_ID;
    if (!clientId) {
      throw new Error(
        'Tesla client_id not configured (set in connection_config or TESLA_CLIENT_ID env)'
      );
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: cfg.refresh_token,
      scope: 'openid offline_access energy_device_data vehicle_device_data',
    });

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      throw new Error(`Tesla token refresh failed: HTTP ${res.status}`);
    }
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const newCfg: TeslaConnectionConfig = {
      ...cfg,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? cfg.refresh_token,
      expires_at: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : undefined,
    };
    this.inMemoryConfig = newCfg;
    if (this.persister) {
      try {
        await this.persister(newCfg as Record<string, unknown>);
      } catch (err) {
        log.warn('failed to persist rotated tokens', { device_id: this.device.id, error: err instanceof Error ? err.message : 'unknown' });
      }
    }
    return tokens.access_token;
  }

  /**
   * Authenticated fetch with one-shot refresh-and-retry on 401. If the
   * persisted access_token expired (HTTP 401), exchange the refresh_token
   * for a new one and replay the original request.
   */
  private async tFetch(path: string, init: RequestInit = {}): Promise<Response> {
    // Build URL only from the allowlisted base; never honor an absolute URL
    // here so the bearer token can't be sent to an arbitrary host.
    const safePath = path.startsWith('http')
      ? new URL(path).pathname + new URL(path).search
      : path;
    const url = `${this.base()}${safePath.startsWith('/') ? safePath : `/${safePath}`}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.inMemoryConfig.access_token}`,
          ...(init.headers ?? {}),
        },
        cache: 'no-store',
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (res.status !== 401) return res;
    // Retry once after refresh.
    const newToken = await this.refreshAccessToken();
    const ctrl2 = new AbortController();
    const t2 = setTimeout(() => ctrl2.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${newToken}`,
          ...(init.headers ?? {}),
        },
        cache: 'no-store',
        signal: ctrl2.signal,
      });
    } finally {
      clearTimeout(t2);
    }
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) return this.unavailableStatus('');

    try {
      // EV vehicle path: use vehicle_data instead of the energy site endpoint.
      if (this.device.type === 'ev') {
        const vehicleId = this.inMemoryConfig.vehicle_id;
        if (!vehicleId)
          return this.unavailableStatus('vehicle_id not set in connection_config');
        const res = await this.tFetch(`/api/1/vehicles/${vehicleId}/vehicle_data`);
        if (!res.ok)
          return this.unavailableStatus(`vehicle_data HTTP ${res.status}`);
        const json = (await res.json()) as VehicleDataResponse;
        const cs = json.response?.charge_state ?? {};
        return {
          deviceId: this.device.id,
          providerType: 'tesla',
          timestamp: new Date(),
          isLive: true,
          evSOCPercent: cs.battery_level ?? 0,
          evChargeRateKw: cs.charger_power ?? 0,
          evPluggedIn:
            (cs.charging_state ?? 'Disconnected').toLowerCase() !==
            'disconnected',
        };
      }

      const siteId = this.inMemoryConfig.site_id;
      if (!siteId) return this.unavailableStatus('site_id not set');
      const res = await this.tFetch(
        `/api/1/energy_sites/${siteId}/live_status`
      );
      if (!res.ok) return this.unavailableStatus(`live_status HTTP ${res.status}`);
      const json = (await res.json()) as LiveStatusResponse;
      const d = json.response ?? {};

      const status: DeviceStatus = {
        deviceId: this.device.id,
        providerType: 'tesla',
        timestamp: d.timestamp ? new Date(d.timestamp) : new Date(),
        isLive: true,
      };

      switch (this.device.type) {
        case 'solar_array':
          status.solarOutputKw = (d.solar_power ?? 0) / 1000;
          break;
        case 'battery':
          status.batterySOCPercent = d.percentage_charged ?? 0;
          // Tesla battery_power: positive = discharging, negative = charging.
          // Our convention: positive = charging.
          status.batteryPowerKw = -(d.battery_power ?? 0) / 1000;
          if (typeof d.total_pack_energy === 'number') {
            status.batteryCapacityKwh = d.total_pack_energy / 1000;
          } else if (this.device.battery_config) {
            status.batteryCapacityKwh = this.device.battery_config.capacity_kwh;
          }
          if (typeof d.energy_left === 'number') {
            status.batterySOCKwh = d.energy_left / 1000;
          } else if (status.batteryCapacityKwh != null) {
            status.batterySOCKwh =
              ((status.batterySOCPercent ?? 0) / 100) * status.batteryCapacityKwh;
          }
          if (this.device.battery_config) {
            status.batteryMaxFlowKw = this.device.battery_config.max_flow_kw;
          }
          break;
        case 'house':
          status.houseLoadKw = (d.load_power ?? 0) / 1000;
          break;
        case 'grid':
          // Tesla grid_power: positive = importing.
          status.gridImportKw = (d.grid_power ?? 0) / 1000;
          status.houseLoadKwSystem = (d.load_power ?? 0) / 1000;
          break;
      }
      return status;
    } catch (err) {
      return this.unavailableStatus(
        err instanceof Error ? err.message : 'unknown network error'
      );
    }
  }

  async getHistory(range: HistoryRange): Promise<HistoricalPoint[]> {
    if (!this.isConfigured()) return [];

    try {
      // Vehicle (EV) history: Tesla Fleet exposes charging-session history
      // via /api/1/dx/vehicles/charging/history (one row per completed
      // session with start/stop timestamps and kWh added). We expand each
      // session that overlaps the requested range into one per-hour
      // sample carrying the session's average kW (kWh / session-hours);
      // the EV route then bucket-averages across vehicles so the chart
      // and energy totals reflect real charging activity rather than
      // collapsing to zero.
      if (this.device.type === 'ev') {
        return this.getEvChargingHistory(range);
      }

      const siteId = this.inMemoryConfig.site_id;
      if (!siteId) return [];

      // Decide which Tesla `kind` to query AND which field of the resulting
      // time_series row to read, jointly from device.type AND metric.
      // Combinations that don't map to a real Tesla field fall back to
      // simulated so we never inject e.g. solar_power into a house chart.
      type FieldExtractor = (pt: PowerHistoryPoint & {
        solar_energy_exported?: number;
        consumer_energy_imported?: number;
        grid_energy_imported?: number;
        grid_energy_exported_from_solar?: number;
        soe?: number;
      }) => number;
      let kind: 'energy' | 'power' | 'soe';
      let extract: FieldExtractor;
      let unit = 'kW';

      const t = this.device.type;
      const m = range.metric;

      if (t === 'solar_array') {
        if (m === 'energy_kwh') {
          kind = 'energy';
          extract = (pt) => (pt.solar_energy_exported ?? 0) / 1000;
          unit = 'kWh';
        } else {
          kind = 'power';
          extract = (pt) => (pt.solar_power ?? 0) / 1000;
        }
      } else if (t === 'house') {
        if (m === 'energy_kwh') {
          kind = 'energy';
          extract = (pt) => (pt.consumer_energy_imported ?? 0) / 1000;
          unit = 'kWh';
        } else if (m === 'power_kw') {
          kind = 'power';
          extract = (pt) => (pt.load_power ?? 0) / 1000;
        } else {
          // unsupported metric for house (e.g. grid_kw, soc_kwh)
          return [];
        }
      } else if (t === 'grid') {
        if (m === 'grid_kw' || m === 'power_kw') {
          kind = 'power';
          extract = (pt) => (pt.grid_power ?? 0) / 1000;
        } else if (m === 'energy_kwh') {
          kind = 'energy';
          extract = (pt) =>
            ((pt.grid_energy_imported ?? 0) -
              (pt.grid_energy_exported_from_solar ?? 0)) /
            1000;
          unit = 'kWh';
        } else {
          return [];
        }
      } else if (t === 'battery') {
        if (m === 'power_kw') {
          kind = 'power';
          // Tesla battery_power: positive = discharging. Flip for our convention.
          extract = (pt) => -(pt.battery_power ?? 0) / 1000;
        } else if (m === 'soc_kwh' || m === 'soc_percent') {
          kind = 'soe';
          const cap = this.device.battery_config?.capacity_kwh ?? 0;
          extract = (pt) =>
            m === 'soc_kwh' ? ((pt.soe ?? 0) / 100) * cap : pt.soe ?? 0;
          unit = m === 'soc_kwh' ? 'kWh' : '%';
        } else if (m === 'energy_kwh') {
          // Battery throughput as energy isn't a meaningful Tesla series — sim
          return [];
        } else {
          return [];
        }
      } else {
        return [];
      }

      const url =
        `/api/1/energy_sites/${siteId}/history` +
        `?kind=${kind}&period=day` +
        `&start_date=${encodeURIComponent(range.startDate.toISOString())}` +
        `&end_date=${encodeURIComponent(range.endDate.toISOString())}`;

      const res = await this.tFetch(url);
      if (!res.ok) {
        log.warn('history HTTP error', { device_id: this.device.id, device_name: this.device.name, status: res.status });
        return [];
      }
      const json = (await res.json()) as {
        response: { time_series?: PowerHistoryPoint[] };
      };
      const series = json.response?.time_series ?? [];

      return series.map((pt) => ({
        timestamp: new Date(pt.timestamp),
        value: extract(pt),
        unit,
      }));
    } catch (err) {
      log.warn('history fetch failed', { device_id: this.device.id, device_name: this.device.name, error: err instanceof Error ? err.message : 'unknown' });
      return [];
    }
  }

  /**
   * Fetch Tesla vehicle charging-session history and expand each session
   * into one sample per ISO hour the session touched, where the sample
   * value is the **overlap-weighted kWh delivered in that hour**. Since
   * a 1-hour bucket of "kW for 1h" equals "kWh for that hour", emitting
   * the kWh figure as the sample value makes the downstream
   * `bucketAvgRate` (which averages across N=1 samples per hour for one
   * vehicle's series) correctly report kWh-per-hour, and the per-hour
   * EV-route sum then yields total kWh.
   *
   * Why overlap-weight: a session lasting 12:55–13:05 (10 minutes) must
   * NOT register as ~2 hours of full-rate charging. With weighting it
   * contributes (avgKw × 5min/60min) kWh to hour 12:00 and
   * (avgKw × 5min/60min) kWh to hour 13:00 — together summing to the
   * session's true kWh.
   *
   * Multiple sessions touching the same hour are summed inside this
   * helper before emitting, so the per-hour series stays at one sample
   * per hour and the bucketAvgRate average == sum (count=1).
   *
   * Tesla Fleet API:
   *   GET /api/1/dx/vehicles/charging/history?vin=:vin&startTime=:iso&endTime=:iso
   * Paginated via `pageSize` (max 50) + `pageId`; we cap at 10 pages
   * (≈500 sessions) to bound the worst-case payload.
   *
   * Metrics other than `charge_kw` (e.g. `soc_percent`) are not exposed
   * by the charging-history endpoint and return [].
   */
  private async getEvChargingHistory(
    range: HistoryRange
  ): Promise<HistoricalPoint[]> {
    if (range.metric !== 'charge_kw') return [];
    // The charging-history endpoint requires the 17-character VIN, NOT
    // Tesla's numeric vehicle_id (which is what status calls use). They
    // are stored as separate connection_config fields so each endpoint
    // gets the identifier it expects. If the user only configured the
    // numeric vehicle_id, EV current status still works but historical
    // charging data is unavailable until they add their VIN.
    const vin = this.inMemoryConfig.vin;
    if (!vin) {
      log.warn('VIN not set — charging history requires VIN, not vehicle_id', { device_id: this.device.id, device_name: this.device.name });
      return [];
    }

    interface TeslaChargingSession {
      vin?: string;
      charge_start_date_time?: string;
      charge_stop_date_time?: string;
      energy_added_in_kwh?: number;
    }
    interface TeslaChargingHistoryResponse {
      response?: {
        data?: TeslaChargingSession[];
        next_page_id?: string | null;
      };
    }

    const collected: TeslaChargingSession[] = [];
    let pageId: string | null = null;
    // Hard cap pagination to keep a runaway dataset from hanging the
    // dashboard; 10 pages × 50 rows = up to 500 sessions, plenty for
    // any 7-day to 1-year window an individual vehicle would produce.
    for (let pageCount = 0; pageCount < 10; pageCount++) {
      const params = new URLSearchParams({
        vin,
        startTime: range.startDate.toISOString(),
        endTime: range.endDate.toISOString(),
        pageSize: '50',
      });
      if (pageId) params.set('pageId', pageId);
      let res: Response;
      try {
        res = await this.tFetch(
          `/api/1/dx/vehicles/charging/history?${params.toString()}`
        );
      } catch (err) {
        log.warn('charging history fetch failed', { device_id: this.device.id, device_name: this.device.name, error: err instanceof Error ? err.message : 'unknown' });
        return [];
      }
      if (!res.ok) {
        log.warn('charging history HTTP error', { device_id: this.device.id, device_name: this.device.name, status: res.status, collected: collected.length });
        break;
      }
      const json = (await res.json()) as TeslaChargingHistoryResponse;
      const rows = json.response?.data ?? [];
      collected.push(...rows);
      pageId = json.response?.next_page_id ?? null;
      if (!pageId || rows.length === 0) break;
    }

    if (collected.length === 0) return [];

    const HOUR_MS = 3_600_000;
    const rangeStartMs = range.startDate.getTime();
    const rangeEndMs = range.endDate.getTime();
    // Per-hour kWh accumulator keyed by hour-start epoch ms. Multiple
    // sessions touching the same hour SUM their overlap-weighted kWh
    // contributions before the final emit, so each hour ends up with
    // exactly one sample (avoiding bucketAvgRate's averaging eating
    // half the energy for double-session hours).
    const hourKwh = new Map<number, number>();

    for (const s of collected) {
      if (!s.charge_start_date_time || !s.charge_stop_date_time) continue;
      const startMs = new Date(s.charge_start_date_time).getTime();
      const stopMs = new Date(s.charge_stop_date_time).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(stopMs)) continue;
      const sessionHours = (stopMs - startMs) / HOUR_MS;
      if (sessionHours <= 0) continue;
      const totalKwh = s.energy_added_in_kwh ?? 0;
      if (totalKwh <= 0) continue;
      const avgKw = totalKwh / sessionHours;

      // Clip to the requested window so a long session that started
      // before the window doesn't contribute kWh outside it.
      const clippedStart = Math.max(startMs, rangeStartMs);
      const clippedStop = Math.min(stopMs, rangeEndMs);
      if (clippedStop <= clippedStart) continue;

      // Walk one ISO hour at a time across the clipped window,
      // attributing each hour only its actual overlap with the session.
      const firstHourStart = new Date(clippedStart);
      firstHourStart.setMinutes(0, 0, 0);
      let hourStartMs = firstHourStart.getTime();
      while (hourStartMs < clippedStop) {
        const hourEndMs = hourStartMs + HOUR_MS;
        const overlapStart = Math.max(hourStartMs, clippedStart);
        const overlapEnd = Math.min(hourEndMs, clippedStop);
        const overlapHours = (overlapEnd - overlapStart) / HOUR_MS;
        if (overlapHours > 0) {
          const kwhThisHour = avgKw * overlapHours;
          hourKwh.set(
            hourStartMs,
            (hourKwh.get(hourStartMs) ?? 0) + kwhThisHour
          );
        }
        hourStartMs = hourEndMs;
      }
    }

    const out: HistoricalPoint[] = [];
    for (const [hourStartMs, kwh] of hourKwh) {
      // Value carries kWh delivered in this hour. Downstream
      // bucketAvgRate sees exactly one sample per hour per vehicle,
      // so its average == this value, which is the per-hour avg kW
      // (since 1 hour wide → kW × 1h = kWh).
      out.push({
        timestamp: new Date(hourStartMs),
        value: kwh,
        unit: 'kW',
      });
    }
    // Sort chronologically — getStatus consumers and the chart key by
    // timestamp order.
    out.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return out;
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Tesla credentials not configured' };
    }
    // Vehicle charge limit is the only currently-supported third-party write.
    if (this.device.type === 'ev' && command.type === 'set_charge_limit') {
      const vehicleId = this.inMemoryConfig.vehicle_id;
      if (!vehicleId) {
        return { success: false, message: 'vehicle_id not configured' };
      }
      const percent = Number(command.payload.percent);
      if (!Number.isFinite(percent)) {
        return { success: false, message: 'percent payload required' };
      }
      try {
        const res = await this.tFetch(
          `/api/1/vehicles/${vehicleId}/command/set_charge_limit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ percent }),
          }
        );
        if (!res.ok)
          return { success: false, message: `Tesla returned HTTP ${res.status}` };
        return { success: true };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'unknown error',
        };
      }
    }
    return {
      success: false,
      message:
        'Tesla write commands beyond set_charge_limit are not exposed to third-party apps yet',
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'tesla',
      displayName: 'Tesla (Powerwall + EV)',
      description:
        'Connect Tesla Powerwall battery storage and Tesla vehicles via the Tesla Fleet API.',
      authMethod: 'oauth2_pkce',
      fields: [
        {
          key: 'access_token',
          label: 'Access Token',
          type: 'password',
          placeholder: 'Paste your Tesla Fleet API access token',
          required: true,
          helpText:
            'Obtain via OAuth2 PKCE flow at https://auth.tesla.com. Requires energy_device_data scope.',
        },
        {
          key: 'refresh_token',
          label: 'Refresh Token',
          type: 'password',
          placeholder: 'Paste your Tesla Fleet API refresh token',
          required: true,
          helpText:
            'Used to automatically renew the access token when it expires.',
        },
        {
          key: 'site_id',
          label: 'Energy Site ID',
          type: 'text',
          placeholder: 'e.g. 1234567890',
          required: true,
          helpText:
            'Find your site_id via GET /api/1/products after authenticating.',
        },
        {
          key: 'vehicle_id',
          label: 'Vehicle ID (optional)',
          type: 'text',
          placeholder: 'e.g. 1234567890',
          required: false,
          helpText:
            "Numeric Tesla Vehicle ID — required for EV current charge status. Find via GET /api/1/vehicles (it's the `id` field, not the VIN).",
        },
        {
          key: 'vin',
          label: 'Vehicle VIN (optional)',
          type: 'text',
          placeholder: 'e.g. 5YJSA1E2XHF000000',
          required: false,
          helpText:
            "17-character VIN — required for EV charging history (24h chart, today/month kWh, last-charged label). Different from the numeric Vehicle ID; find via GET /api/1/vehicles (it's the `vin` field).",
        },
        {
          key: 'client_id',
          label: 'OAuth Client ID (optional)',
          type: 'text',
          placeholder: 'Your Tesla developer app client_id',
          required: false,
          helpText:
            'Used to refresh expired access tokens. Falls back to the TESLA_CLIENT_ID env var if unset.',
        },
      ],
      setupInstructions:
        'Register your app at https://developer.tesla.com, complete the OAuth2 PKCE flow to get tokens, then find your site_id via the /products endpoint.',
    };
  }
}
