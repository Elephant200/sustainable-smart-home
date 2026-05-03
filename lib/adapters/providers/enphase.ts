/**
 * Enphase Enlighten API Adapter
 *
 * Real API reference: https://developer-v4.enphase.com/docs.html
 *
 * Auth: OAuth2 (authorization code flow)
 *   - Authorization URL: https://api.enphaseenergy.com/oauth/authorize
 *   - Token URL:         https://api.enphaseenergy.com/oauth/token
 *   - Scopes required:   (per app registration)
 *
 * Endpoints used:
 *   GET /api/v4/systems/:system_id/summary
 *     -> current_power (W), energy_today (Wh), last_report_at
 *   GET /api/v4/systems/:system_id/telemetry/production_micro
 *     -> intervals[]: { end_at, powr (W), enwh (Wh) }
 *   GET /api/v4/systems/:system_id/telemetry/battery
 *     -> intervals[]: { end_at, soc, charge.enwh, discharge.enwh }
 *
 * connection_config shape:
 *   { api_key: string; access_token: string; refresh_token?: string;
 *     system_id: string; client_id?: string; client_secret?: string;
 *     expires_at?: number }
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

const log = createLogger({ provider: 'enphase' });

interface EnphaseConnectionConfig {
  api_key?: string;
  access_token?: string;
  refresh_token?: string;
  system_id?: string;
  client_id?: string;
  client_secret?: string;
  expires_at?: number;
}

interface SummaryResponse {
  current_power?: number;
  energy_today?: number;
  last_report_at?: number;
}

interface BatteryTelemetryResponse {
  intervals?: Array<{
    end_at: number;
    soc?: { percent?: number };
    charge?: { enwh?: number };
    discharge?: { enwh?: number };
  }>;
}

interface ProductionTelemetryResponse {
  intervals?: Array<{ end_at: number; powr?: number; enwh?: number }>;
}

const REQUEST_TIMEOUT_MS = 12_000;
const BASE = 'https://api.enphaseenergy.com';
const TOKEN_URL = `${BASE}/oauth/token`;

export class EnphaseAdapter implements DeviceAdapter {
  readonly providerType = 'enphase' as const;
  private device: DeviceRecord;
  private persister?: CredentialPersister;
  private inMemoryConfig: EnphaseConnectionConfig;

  constructor(device: DeviceRecord, persister?: CredentialPersister) {
    this.device = device;
    this.persister = persister;
    this.inMemoryConfig = { ...(device.connection_config as EnphaseConnectionConfig) };
  }

  isConfigured(): boolean {
    return hasStoredCredentials(this.device.connection_config, [
      'api_key',
      'access_token',
      'system_id',
    ]);
  }

  /**
   * Returns an "unavailable" status with no data fields populated when a
   * live Enphase call fails. Real-provider devices MUST NEVER fall back to
   * simulator output; routes / UI surface `isLive=false` and the `error`
   * reason so users see the outage instead of a fabricated value.
   */
  private unavailableStatus(reason: string): DeviceStatus {
    if (reason)
      log.warn('live data unavailable', { device_id: this.device.id, device_name: this.device.name, reason });
    return {
      deviceId: this.device.id,
      providerType: 'enphase',
      timestamp: new Date(),
      isLive: false,
      error: reason || 'Enphase credentials not configured',
    };
  }

  /**
   * Refresh OAuth access_token using the persisted refresh_token. Enphase
   * uses HTTP Basic auth with client_id:client_secret on the token endpoint.
   * Persists rotated tokens via the configured persister.
   */
  private async refreshAccessToken(): Promise<string> {
    const cfg = this.inMemoryConfig;
    if (!cfg.refresh_token) {
      throw new Error('No refresh_token available for Enphase token refresh');
    }
    const clientId = cfg.client_id ?? process.env.ENPHASE_CLIENT_ID;
    const clientSecret = cfg.client_secret ?? process.env.ENPHASE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        'Enphase client_id/client_secret not configured (set in connection_config or ENPHASE_CLIENT_ID / ENPHASE_CLIENT_SECRET env)'
      );
    }
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(
        `${TOKEN_URL}?grant_type=refresh_token&refresh_token=${encodeURIComponent(cfg.refresh_token)}`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${basic}` },
          signal: ctrl.signal,
        }
      );
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      throw new Error(`Enphase token refresh failed: HTTP ${res.status}`);
    }
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const newCfg: EnphaseConnectionConfig = {
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
   * Authenticated fetch with one-shot refresh-and-retry on 401.
   */
  private async eFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const cfg = this.inMemoryConfig;
    const sep = path.includes('?') ? '&' : '?';
    const urlWithKey = `${BASE}${path}${sep}key=${encodeURIComponent(cfg.api_key ?? '')}`;

    const doFetch = async (token: string): Promise<Response> => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        return await fetch(urlWithKey, {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init.headers ?? {}),
          },
          cache: 'no-store',
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(t);
      }
    };

    let res = await doFetch(cfg.access_token ?? '');
    if (res.status === 401) {
      const newToken = await this.refreshAccessToken();
      res = await doFetch(newToken);
    }
    return res;
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) return this.unavailableStatus('');
    const systemId = this.inMemoryConfig.system_id;
    if (!systemId) return this.unavailableStatus('system_id not set');

    try {
      // Battery devices read from the battery telemetry endpoint to get SoC.
      if (this.device.type === 'battery') {
        const res = await this.eFetch(
          `/api/v4/systems/${encodeURIComponent(systemId)}/telemetry/battery?granularity=15mins`
        );
        if (!res.ok)
          return this.unavailableStatus(`battery telemetry HTTP ${res.status}`);
        const json = (await res.json()) as BatteryTelemetryResponse;
        const intervals = json.intervals ?? [];
        const last = intervals[intervals.length - 1];
        if (!last) return this.unavailableStatus('no battery intervals returned');
        const socPct = last.soc?.percent ?? 0;
        const chargeWh = last.charge?.enwh ?? 0;
        const dischargeWh = last.discharge?.enwh ?? 0;
        // 15 min interval → power = (energy / 0.25h)
        const intervalHours = 0.25;
        const powerKw = (chargeWh - dischargeWh) / 1000 / intervalHours;
        const status: DeviceStatus = {
          deviceId: this.device.id,
          providerType: 'enphase',
          timestamp: new Date(last.end_at * 1000),
          isLive: true,
          batterySOCPercent: socPct,
          batteryPowerKw: powerKw,
        };
        if (this.device.battery_config) {
          status.batteryCapacityKwh = this.device.battery_config.capacity_kwh;
          status.batteryMaxFlowKw = this.device.battery_config.max_flow_kw;
          status.batterySOCKwh =
            (socPct / 100) * this.device.battery_config.capacity_kwh;
        }
        return status;
      }

      // Solar / house / grid: use the system summary.
      const res = await this.eFetch(
        `/api/v4/systems/${encodeURIComponent(systemId)}/summary`
      );
      if (!res.ok) return this.unavailableStatus(`summary HTTP ${res.status}`);
      const d = (await res.json()) as SummaryResponse;
      const status: DeviceStatus = {
        deviceId: this.device.id,
        providerType: 'enphase',
        timestamp: d.last_report_at
          ? new Date(d.last_report_at * 1000)
          : new Date(),
        isLive: true,
      };
      if (this.device.type === 'solar_array') {
        status.solarOutputKw = (d.current_power ?? 0) / 1000;
      }
      // Enphase doesn't report house/grid for non-Envoy systems via summary;
      // fall back if those device types are configured against Enphase alone.
      if (this.device.type === 'house' || this.device.type === 'grid') {
        return this.unavailableStatus(
          `Enphase summary does not expose ${this.device.type} flow`
        );
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
    const systemId = this.inMemoryConfig.system_id;
    if (!systemId) return [];

    try {
      const start_at = Math.floor(range.startDate.getTime() / 1000);
      // For ranges over 7 days the 15-min telemetry payload would be
      // unmanageably large (a 7-month window is ~20k intervals per system),
      // so we ask Enphase for daily aggregates. Daily samples are then
      // **expanded into 24 per-hour samples** below so the downstream
      // hourly walker in `solveFlowsHistoryFromAdapters` doesn't collapse
      // a whole day's energy into one ISO-hour bucket (the previous bug:
      // one giant daily spike on Analytics 3m/1y views).
      const granularity =
        (range.endDate.getTime() - range.startDate.getTime()) / 1000 > 7 * 86400
          ? 'day'
          : '15mins';
      const isDaily = granularity === 'day';

      if (this.device.type === 'battery') {
        const res = await this.eFetch(
          `/api/v4/systems/${encodeURIComponent(systemId)}/telemetry/battery` +
            `?start_at=${start_at}&granularity=${granularity}`
        );
        if (!res.ok) {
          log.warn('battery history HTTP error', { device_id: this.device.id, device_name: this.device.name, status: res.status });
          return [];
        }
        const json = (await res.json()) as BatteryTelemetryResponse;
        const cap = this.device.battery_config?.capacity_kwh ?? 0;
        const out: HistoricalPoint[] = [];
        for (const iv of json.intervals ?? []) {
          const pct = iv.soc?.percent ?? 0;
          const chargeWh = iv.charge?.enwh ?? 0;
          const dischargeWh = iv.discharge?.enwh ?? 0;
          const intervalHours = isDaily ? 24 : 0.25;
          const powerKw = (chargeWh - dischargeWh) / 1000 / intervalHours;
          const baseValue =
            range.metric === 'soc_kwh'
              ? (pct / 100) * cap
              : range.metric === 'power_kw'
                ? powerKw
                : pct;
          const unit =
            range.metric === 'power_kw'
              ? 'kW'
              : range.metric === 'soc_kwh'
                ? 'kWh'
                : '%';

          if (!isDaily) {
            out.push({
              timestamp: new Date(iv.end_at * 1000),
              value: baseValue,
              unit,
            });
            continue;
          }

          // Daily granularity: emit 24 hourly samples covering
          // (end_at - 24h, end_at]. SoC percent + soc_kwh are level
          // snapshots — we don't have hourly resolution, so we replicate
          // the end-of-day value across every hour (the bucket-last-
          // instant aggregator will still pick one per hour). Power kW
          // is the daily-average flow distributed evenly across the day.
          const dayEndMs = iv.end_at * 1000;
          for (let h = 0; h < 24; h++) {
            out.push({
              timestamp: new Date(dayEndMs - (23 - h) * 3600_000),
              value: baseValue,
              unit,
            });
          }
        }
        return out;
      }

      // Enphase only exposes solar production telemetry. House/grid
      // history isn't available — mirror getStatus() behavior and return
      // an empty series so the route surfaces the gap as zeros (per the
      // explicit-only simulator policy) instead of injecting PV data
      // into the wrong chart.
      if (this.device.type === 'house' || this.device.type === 'grid') {
        return [];
      }

      // Solar production — energy_kwh per interval.
      const res = await this.eFetch(
        `/api/v4/systems/${encodeURIComponent(systemId)}/telemetry/production_micro` +
          `?start_at=${start_at}&granularity=${granularity}`
      );
      if (!res.ok) {
        log.warn('production history HTTP error', { device_id: this.device.id, device_name: this.device.name, status: res.status });
        return [];
      }
      const json = (await res.json()) as ProductionTelemetryResponse;
      const out: HistoricalPoint[] = [];
      for (const iv of json.intervals ?? []) {
        const dayKwh = (iv.enwh ?? 0) / 1000;
        if (!isDaily) {
          out.push({
            timestamp: new Date(iv.end_at * 1000),
            value: dayKwh,
            unit: 'kWh',
          });
          continue;
        }
        // Daily granularity: split the day's total kWh evenly across 24
        // hours. Sum across the day is preserved (correct kWh totals),
        // and the hourly walker no longer dumps the whole day into one
        // bucket as a 100+ kW spike.
        const perHour = dayKwh / 24;
        const dayEndMs = iv.end_at * 1000;
        for (let h = 0; h < 24; h++) {
          out.push({
            timestamp: new Date(dayEndMs - (23 - h) * 3600_000),
            value: perHour,
            unit: 'kWh',
          });
        }
      }
      return out;
    } catch (err) {
      log.warn('history fetch failed', { device_id: this.device.id, device_name: this.device.name, error: err instanceof Error ? err.message : 'unknown' });
      return [];
    }
  }

  async sendCommand(
    _command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message: 'Enphase Enlighten API is read-only; control commands are not supported',
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'enphase',
      displayName: 'Enphase (Solar + IQ Battery)',
      description:
        'Connect Enphase microinverter solar arrays and IQ Battery storage via the Enlighten API v4.',
      authMethod: 'oauth2',
      fields: [
        {
          key: 'api_key',
          label: 'API Key',
          type: 'password',
          placeholder: 'Your Enphase app API key',
          required: true,
          helpText:
            'Create an app at https://developer-v4.enphase.com to obtain an API key.',
        },
        {
          key: 'access_token',
          label: 'Access Token',
          type: 'password',
          placeholder: 'OAuth2 access token',
          required: true,
          helpText:
            'Obtained via OAuth2 authorization code flow. See https://developer-v4.enphase.com/docs.html.',
        },
        {
          key: 'refresh_token',
          label: 'Refresh Token',
          type: 'password',
          placeholder: 'OAuth2 refresh token',
          required: false,
          helpText:
            'If provided, the adapter automatically renews the access token when it expires.',
        },
        {
          key: 'system_id',
          label: 'System ID',
          type: 'text',
          placeholder: 'e.g. 123456',
          required: true,
          helpText:
            'Your Enphase system ID, visible in the Enlighten Manager URL or via GET /api/v4/systems.',
        },
        {
          key: 'client_id',
          label: 'OAuth Client ID (optional)',
          type: 'text',
          placeholder: 'Your Enphase app client_id',
          required: false,
          helpText:
            'Used together with client_secret to refresh expired tokens. Falls back to the ENPHASE_CLIENT_ID env var.',
        },
        {
          key: 'client_secret',
          label: 'OAuth Client Secret (optional)',
          type: 'password',
          placeholder: 'Your Enphase app client_secret',
          required: false,
          helpText:
            'Used together with client_id to refresh expired tokens. Falls back to the ENPHASE_CLIENT_SECRET env var.',
        },
      ],
      setupInstructions:
        'Register at https://developer-v4.enphase.com, complete OAuth2 to get tokens, then retrieve your system_id via /api/v4/systems.',
    };
  }
}
