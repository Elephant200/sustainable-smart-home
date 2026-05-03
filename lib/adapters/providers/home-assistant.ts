/**
 * Home Assistant REST API Adapter
 *
 * Real API reference: https://developers.home-assistant.io/docs/api/rest
 *
 * Auth: Long-lived access token (Bearer)
 *   - Create in HA profile page: Settings → Profile → Long-Lived Access Tokens
 *
 * Endpoints used:
 *   GET  /api/states/:entity_id
 *     -> state (string), attributes (object), last_updated
 *   GET  /api/history/period/:start?filter_entity_id=:entity_id&end_time=:end
 *     -> [[{ state, last_updated }]]
 *   POST /api/services/:domain/:service
 *     -> triggers a Home Assistant service (e.g. number.set_value for charge limit)
 *
 * Entity mapping is configured per-device via connection_config.entity_id.
 *
 * connection_config shape:
 *   { base_url: string; token: string; entity_id: string; power_unit?: 'W' | 'kW' }
 */

import {
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

const log = createLogger({ provider: 'home_assistant' });

interface HaConnectionConfig {
  base_url?: string;
  token?: string;
  /** The instantaneous-reading sensor used by getStatus():
   *  - solar / house / grid: a power sensor (W or kW)
   *  - battery / ev:        a state-of-charge percent sensor (0–100)
   * For solar / house / grid this entity also serves as the source for
   * power-shaped history. For battery / ev (whose entity_id is a percent
   * sensor) power-shaped history requires `power_entity_id` below. */
  entity_id?: string;
  /** Optional separate cumulative-energy sensor (Wh/kWh/MWh). When set,
   * getHistory({ metric: 'energy_kwh' }) queries this entity instead of
   * `entity_id`. Lets users pair a power sensor for live readings with an
   * energy meter for historical totals on the same role. */
  energy_entity_id?: string;
  /** Optional separate power sensor (W/kW) used for power-shaped history
   * of battery (`power_kw`) and EV (`charge_kw`) devices. The primary
   * `entity_id` for those device types is a SoC percent sensor and
   * therefore cannot answer power queries — when this field is unset
   * power-shaped history returns [] (so the route surfaces the gap as
   * zero rather than reinterpreting SoC % as kW, which was the bug
   * before this field existed). For solar / house / grid devices this
   * field is unused; their `entity_id` already IS a power sensor. */
  power_entity_id?: string;
  /** Hint used only when the HA payload omits `unit_of_measurement`. */
  power_unit?: 'W' | 'kW';
}

interface HaState {
  state: string;
  attributes?: { unit_of_measurement?: string };
  last_updated?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * SSRF guard: reject Home Assistant URLs that target loopback, link-local,
 * private RFC1918 ranges, or cloud metadata endpoints. Home Assistant is
 * almost always self-hosted on a LAN, so the safe path for production is to
 * require an explicit allowlist of hostnames via HOME_ASSISTANT_ALLOWED_HOSTS.
 *
 * In dev/test (NODE_ENV !== 'production') we permit private hostnames so
 * locally-hosted HA instances work out of the box. The cloud-metadata block
 * is enforced in every environment.
 */
const ALWAYS_BLOCKED_HOSTS = new Set([
  '169.254.169.254', // AWS / GCP / Azure IMDS
  'metadata.google.internal',
  'metadata.goog',
]);

function validateHomeAssistantUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `disallowed protocol: ${url.protocol}` };
  }
  const host = url.hostname.toLowerCase();
  if (ALWAYS_BLOCKED_HOSTS.has(host)) {
    return { ok: false, reason: `host ${host} is blocked (cloud metadata endpoint)` };
  }

  const allowList = (process.env.HOME_ASSISTANT_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowList.length > 0) {
    if (!allowList.includes(host)) {
      return {
        ok: false,
        reason: `host ${host} is not in HOME_ASSISTANT_ALLOWED_HOSTS allowlist`,
      };
    }
    return { ok: true, url };
  }

  // No explicit allowlist. In production, refuse private/loopback addresses
  // and unresolvable .local mDNS names to prevent SSRF into internal services.
  if (process.env.NODE_ENV === 'production') {
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^::1$/.test(host) ||
      /^fc[0-9a-f]{2}:/i.test(host) ||
      /^fd[0-9a-f]{2}:/i.test(host)
    ) {
      return {
        ok: false,
        reason: `host ${host} is private/loopback; set HOME_ASSISTANT_ALLOWED_HOSTS to permit it`,
      };
    }
  }
  return { ok: true, url };
}

async function haFetch(
  url: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
      signal: ctrl.signal,
      // Reject redirects so a malicious HA instance can't bounce us to
      // a different (possibly internal) target.
      redirect: 'manual',
    });
  } finally {
    clearTimeout(t);
  }
}

function trimUrl(u: string): string {
  return u.replace(/\/+$/, '');
}

export class HomeAssistantAdapter implements DeviceAdapter {
  readonly providerType = 'home_assistant' as const;
  private device: DeviceRecord;

  constructor(device: DeviceRecord) {
    this.device = device;
  }

  isConfigured(): boolean {
    return hasStoredCredentials(this.device.connection_config, [
      'base_url',
      'token',
      'entity_id',
    ]);
  }

  private cfg(): Required<Pick<HaConnectionConfig, 'base_url' | 'token' | 'entity_id'>> &
    Pick<HaConnectionConfig, 'power_unit'> {
    const c = this.device.connection_config as HaConnectionConfig;
    return {
      base_url: trimUrl(c.base_url ?? ''),
      token: c.token ?? '',
      entity_id: c.entity_id ?? '',
      power_unit: c.power_unit,
    };
  }

  // The cfg() helper above only narrows REQUIRED fields. Optional fields
  // like `energy_entity_id` are read directly off device.connection_config.

  /**
   * Validates the configured base URL with the SSRF guard. Returns a normalized
   * (host-canonicalized) URL string when allowed, or null when blocked. Logs
   * the rejection reason so operators can grant an allowlist entry.
   */
  private safeBaseUrl(): string | null {
    const cfg = this.cfg();
    const v = validateHomeAssistantUrl(cfg.base_url);
    if (!v.ok) {
      log.warn('blocked URL', { device_id: this.device.id, device_name: this.device.name, url: cfg.base_url, reason: v.reason });
      return null;
    }
    // Strip any trailing slash and any path the user pasted past the host;
    // we always append our own /api/* path.
    return `${v.url.protocol}//${v.url.host}`;
  }

  private toKw(value: number, reportedUnit: string | undefined): number {
    const cfg = this.device.connection_config as HaConnectionConfig;
    const unit = cfg.power_unit ?? reportedUnit ?? 'kW';
    return unit === 'W' ? value / 1000 : value;
  }

  /**
   * Returns an "unavailable" status with no data fields populated when a
   * live Home Assistant call fails. Real-provider devices MUST NEVER fall
   * back to simulator output; routes / UI surface `isLive=false` and the
   * `error` reason so users see the outage instead of a fabricated value.
   */
  private unavailableStatus(reason: string): DeviceStatus {
    if (reason) {
      log.warn('live data unavailable', { device_id: this.device.id, device_name: this.device.name, reason });
    }
    return {
      deviceId: this.device.id,
      providerType: 'home_assistant',
      timestamp: new Date(),
      isLive: false,
      error: reason || 'Home Assistant credentials not configured',
    };
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) {
      return this.unavailableStatus('');
    }
    const cfg = this.cfg();
    const base = this.safeBaseUrl();
    if (!base) return this.unavailableStatus('base_url failed SSRF validation');
    try {
      const res = await haFetch(
        `${base}/api/states/${encodeURIComponent(cfg.entity_id)}`,
        cfg.token
      );
      if (!res.ok) {
        return this.unavailableStatus(`HTTP ${res.status} from /states`);
      }
      const entity = (await res.json()) as HaState;
      const raw = parseFloat(entity.state);
      if (!Number.isFinite(raw)) {
        return this.unavailableStatus(
          `entity ${cfg.entity_id} returned non-numeric state "${entity.state}"`
        );
      }
      // Reject mismatched entities: a cumulative-energy meter (kWh) cannot
      // populate an instantaneous power-shaped status; a non-percent entity
      // can't populate battery SoC. We surface the misconfiguration as
      // unavailable rather than fabricating an instantaneous reading.
      const reportedUnit = (
        entity.attributes?.unit_of_measurement ?? ''
      ).toLowerCase();
      const isEnergyUnit =
        reportedUnit === 'wh' || reportedUnit === 'kwh' || reportedUnit === 'mwh';
      const isPercentUnit = reportedUnit === '%';
      if (this.device.type === 'battery' && reportedUnit && !isPercentUnit) {
        return this.unavailableStatus(
          `battery entity ${cfg.entity_id} reports "${reportedUnit}"; expected percent SoC`
        );
      }
      if (
        (this.device.type === 'solar_array' ||
          this.device.type === 'house' ||
          this.device.type === 'grid') &&
        isEnergyUnit
      ) {
        return this.unavailableStatus(
          `${this.device.type} entity ${cfg.entity_id} reports "${reportedUnit}" (energy); configure a power sensor (W/kW) for live status`
        );
      }
      const safe = raw;
      const ts = entity.last_updated ? new Date(entity.last_updated) : new Date();

      const status: DeviceStatus = {
        deviceId: this.device.id,
        providerType: 'home_assistant',
        timestamp: ts,
        isLive: true,
      };

      switch (this.device.type) {
        case 'solar_array':
          status.solarOutputKw = this.toKw(safe, entity.attributes?.unit_of_measurement);
          break;
        case 'battery': {
          // Convention: entity_id is the SoC sensor (0–100).
          status.batterySOCPercent = safe;
          if (this.device.battery_config) {
            status.batteryCapacityKwh = this.device.battery_config.capacity_kwh;
            status.batteryMaxFlowKw = this.device.battery_config.max_flow_kw;
            status.batterySOCKwh =
              (safe / 100) * this.device.battery_config.capacity_kwh;
          }
          // Live battery power (kW): if the user configured a separate
          // power sensor, fetch it now so the snapshot/battery routes
          // surface a real `batteryPowerKw` instead of leaving it null.
          // Sign convention upstream: positive = charging. HA power
          // sensors are typically signed already; we honor the unit
          // hint and pass the value through unchanged.
          const batPower = await this.fetchPowerEntityKw();
          if (batPower != null) status.batteryPowerKw = batPower;
          break;
        }
        case 'house':
          status.houseLoadKw = this.toKw(safe, entity.attributes?.unit_of_measurement);
          break;
        case 'grid':
          status.gridImportKw = this.toKw(safe, entity.attributes?.unit_of_measurement);
          break;
        case 'ev': {
          status.evSOCPercent = safe;
          // Live EV charge rate (kW): from the optional power sensor.
          // Many HA EV integrations expose 0 kW when not actively
          // charging, so derive `evPluggedIn` as "rate > 0 OR rate
          // explicitly available" — the EV route then renders charging
          // state correctly. When no power sensor is configured, leave
          // both unset so the dashboard surfaces the gap honestly.
          const evRate = await this.fetchPowerEntityKw();
          if (evRate != null) {
            status.evChargeRateKw = evRate;
            status.evPluggedIn = evRate > 0;
          }
          break;
        }
      }
      return status;
    } catch (err) {
      return this.unavailableStatus(
        err instanceof Error ? err.message : 'unknown network error'
      );
    }
  }

  /**
   * Fetch the optional `power_entity_id` sensor and return its current
   * value in kW. Returns null when the field isn't configured, the
   * fetch fails, or the entity returns a non-power unit (so we never
   * mislabel SoC %, energy kWh, etc., as kilowatts). Used by getStatus
   * to populate `batteryPowerKw` and `evChargeRateKw` for HA-backed
   * battery/EV devices whose primary `entity_id` is the SoC sensor.
   */
  private async fetchPowerEntityKw(): Promise<number | null> {
    const c = this.device.connection_config as HaConnectionConfig;
    if (!c.power_entity_id) return null;
    const cfg = this.cfg();
    const base = this.safeBaseUrl();
    if (!base) return null;
    try {
      const res = await haFetch(
        `${base}/api/states/${encodeURIComponent(c.power_entity_id)}`,
        cfg.token
      );
      if (!res.ok) {
        log.warn('power_entity_id HTTP error', { device_id: this.device.id, device_name: this.device.name, status: res.status });
        return null;
      }
      const entity = (await res.json()) as HaState;
      const raw = parseFloat(entity.state);
      if (!Number.isFinite(raw)) return null;
      const reportedUnit = (
        entity.attributes?.unit_of_measurement ?? c.power_unit ?? 'kW'
      ).toLowerCase();
      // Only accept power units; reject percent / energy.
      if (
        reportedUnit !== 'w' &&
        reportedUnit !== 'kw' &&
        reportedUnit !== 'mw'
      ) {
        log.warn('power_entity_id reports unexpected unit', { device_id: this.device.id, device_name: this.device.name, unit: reportedUnit });
        return null;
      }
      return reportedUnit === 'w'
        ? raw / 1000
        : reportedUnit === 'mw'
          ? raw * 1000
          : raw;
    } catch (err) {
      log.warn('power_entity_id fetch failed', { device_id: this.device.id, device_name: this.device.name, error: err instanceof Error ? err.message : 'unknown' });
      return null;
    }
  }

  async getHistory(range: HistoryRange): Promise<HistoricalPoint[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const cfg = this.cfg();
    const base = this.safeBaseUrl();
    if (!base) return [];

    // A single HA entity is either a power sensor (W/kW), an energy meter
    // (Wh/kWh), or a SoC percent — never two at once. We therefore choose
    // which entity to query AND which metrics it can answer based on the
    // requested `range.metric`, the device type, and the optional
    // `energy_entity_id` / `power_entity_id` overrides:
    //   - energy_kwh:        prefer energy_entity_id, else entity_id;
    //                        ONLY emit Wh/kWh/MWh samples.
    //   - soc_kwh/soc_percent (batteries):
    //                        entity_id (the SoC sensor); only '%' samples.
    //   - power-shaped (power_kw / grid_kw / charge_kw):
    //                        - solar/house/grid: entity_id IS a power sensor.
    //                        - battery/ev:       entity_id is SoC %, so we
    //                          require an explicit `power_entity_id`. If
    //                          none is configured we return [] — the route
    //                          surfaces the gap as zero rather than
    //                          reinterpreting SoC % as kW.
    // Samples whose unit doesn't match the requested metric are skipped
    // rather than silently re-interpreted, so a misconfigured pairing
    // shows missing data (then `isLive:false`) instead of wrong data.
    const c = this.device.connection_config as HaConnectionConfig;
    const wantEnergy = range.metric === 'energy_kwh';
    const wantSoc =
      this.device.type === 'battery' &&
      (range.metric === 'soc_kwh' || range.metric === 'soc_percent');
    const wantPower = !wantEnergy && !wantSoc;
    const isSocOnlyDevice =
      this.device.type === 'battery' || this.device.type === 'ev';

    let queryEntity: string;
    if (wantEnergy) {
      queryEntity = c.energy_entity_id || cfg.entity_id;
    } else if (wantPower && isSocOnlyDevice) {
      // Battery/EV power requires a separate power sensor; entity_id is
      // the SoC sensor and cannot answer power queries.
      if (!c.power_entity_id) return [];
      queryEntity = c.power_entity_id;
    } else {
      queryEntity = cfg.entity_id;
    }

    try {
      const start = range.startDate.toISOString();
      const end = range.endDate.toISOString();
      const url =
        `${base}/api/history/period/${encodeURIComponent(start)}` +
        `?filter_entity_id=${encodeURIComponent(queryEntity)}` +
        `&end_time=${encodeURIComponent(end)}&minimal_response=true`;
      const res = await haFetch(url, cfg.token);
      if (!res.ok) {
        log.warn('history HTTP error', { device_id: this.device.id, device_name: this.device.name, status: res.status });
        return [];
      }
      const json = (await res.json()) as Array<
        Array<{ state: string; last_updated: string; attributes?: { unit_of_measurement?: string } }>
      >;
      const series = json[0] ?? [];
      const capacityKwh = this.device.battery_config?.capacity_kwh ?? 0;

      // Default unit assumption when the HA payload omits unit_of_measurement
      // (some templates do): trust the configured `power_unit` for power
      // metrics, assume kWh for energy metrics, and '%' for SoC reads.
      const defaultUnitForMetric = (): string => {
        if (wantSoc) return '%';
        if (wantEnergy) return 'kWh';
        return c.power_unit ?? 'kW';
      };

      // Normalize each raw HA sample into either a power-shaped, percent,
      // or energy point (still cumulative for energy meters — we delta
      // them below). We retain `null` for samples whose unit doesn't match
      // the requested metric so the energy-delta pass can detect (and
      // skip) cumulative-meter resets without crossing into stale values.
      type Norm = { timestamp: Date; value: number; unit: string } | null;
      const normalized: Norm[] = series.map((pt) => {
        const v = parseFloat(pt.state);
        if (!Number.isFinite(v)) return null;
        const reportedUnit = (
          pt.attributes?.unit_of_measurement ?? defaultUnitForMetric()
        ).toLowerCase();
        const isEnergyUnit =
          reportedUnit === 'wh' || reportedUnit === 'kwh' || reportedUnit === 'mwh';
        const isPowerUnit =
          reportedUnit === 'w' || reportedUnit === 'kw' || reportedUnit === 'mw';
        const isPercentUnit = reportedUnit === '%';

        // SoC reads (battery only): entity must be a percent sensor.
        if (wantSoc) {
          if (!isPercentUnit) return null;
          if (range.metric === 'soc_kwh') {
            return {
              timestamp: new Date(pt.last_updated),
              value: (v / 100) * capacityKwh,
              unit: 'kWh',
            };
          }
          return { timestamp: new Date(pt.last_updated), value: v, unit: '%' };
        }

        if (wantEnergy) {
          if (!isEnergyUnit) return null;
          // Convert to kWh but keep the cumulative meter reading; we
          // delta-walk in the next pass.
          const value =
            reportedUnit === 'wh' ? v / 1000 : reportedUnit === 'mwh' ? v * 1000 : v;
          return { timestamp: new Date(pt.last_updated), value, unit: 'kWh' };
        }

        if (!isPowerUnit) return null;
        const value =
          reportedUnit === 'w' ? v / 1000 : reportedUnit === 'mw' ? v * 1000 : v;
        return { timestamp: new Date(pt.last_updated), value, unit: 'kW' };
      });

      const cleaned = normalized.filter((p): p is NonNullable<Norm> => p !== null);

      if (!wantEnergy) {
        // Power / percent metrics: emit the per-sample value as-is.
        return cleaned;
      }

      // Energy metric: HA energy meters are cumulative (e.g. 100 → 101 →
      // 102 kWh). Returning the raw cumulative readings to a downstream
      // bucket-summer would double-, triple-, …-count. Emit per-interval
      // deltas instead. Sort by timestamp first so an unsorted HA payload
      // doesn't produce negative spikes; skip negative deltas (meter
      // reset / device replacement / explicit zero on power loss).
      cleaned.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const deltas: HistoricalPoint[] = [];
      let prev: number | null = null;
      for (const pt of cleaned) {
        if (prev != null) {
          const delta = pt.value - prev;
          if (delta >= 0) {
            deltas.push({ timestamp: pt.timestamp, value: delta, unit: 'kWh' });
          }
          // Negative delta → meter reset; skip this interval but keep
          // `prev` advancing so the NEXT interval is measured against
          // the post-reset baseline (no fabricated double-count).
        }
        prev = pt.value;
      }
      return deltas;
    } catch (err) {
      log.warn('history fetch failed', { device_id: this.device.id, device_name: this.device.name, error: err instanceof Error ? err.message : 'unknown' });
      return [];
    }
  }

  async sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Home Assistant credentials not configured' };
    }
    const cfg = this.cfg();
    const base = this.safeBaseUrl();
    if (!base) return { success: false, message: 'base_url failed SSRF validation' };
    try {
      // Simple mapping: use number.set_value for SoC-like targets, fallback to
      // service call referenced in the command payload.
      const domain = (command.payload.domain as string) ?? 'number';
      const service = (command.payload.service as string) ?? 'set_value';
      const res = await haFetch(
        `${base}/api/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}`,
        cfg.token,
        {
          method: 'POST',
          body: JSON.stringify({
            entity_id: cfg.entity_id,
            ...command.payload,
          }),
        }
      );
      if (!res.ok) {
        return { success: false, message: `Home Assistant returned HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'home_assistant',
      displayName: 'Home Assistant',
      description:
        'Connect any device supported by Home Assistant (Zigbee, Z-Wave, Matter, and more) via the local REST API.',
      authMethod: 'local_token',
      fields: [
        {
          key: 'base_url',
          label: 'Home Assistant URL',
          type: 'url',
          placeholder: 'http://homeassistant.local:8123',
          required: true,
          helpText:
            'The local network URL of your Home Assistant instance. Must be reachable from this server.',
        },
        {
          key: 'token',
          label: 'Long-Lived Access Token',
          type: 'password',
          placeholder: 'Paste your long-lived access token',
          required: true,
          helpText:
            'Generate in HA: Settings → Profile → Long-Lived Access Tokens.',
        },
        {
          key: 'entity_id',
          label: 'Entity ID',
          type: 'text',
          placeholder: 'sensor.solar_power',
          required: true,
          helpText:
            "The HA entity that reports this device's instantaneous reading. For solar/house/grid: a power sensor (W or kW). For batteries: a state-of-charge percent sensor (0–100). Energy meters (Wh/kWh) belong in Energy Entity ID below.",
        },
        {
          key: 'energy_entity_id',
          label: 'Energy Entity ID (optional)',
          type: 'text',
          placeholder: 'sensor.solar_energy_total',
          required: false,
          helpText:
            'Optional cumulative-energy sensor (Wh / kWh / MWh) used for historical energy charts. When set, history queries hit this entity; when omitted, samples whose unit is not Wh/kWh/MWh are skipped instead of being mislabeled.',
        },
        {
          key: 'power_entity_id',
          label: 'Power Entity ID (battery / EV only, optional)',
          type: 'text',
          placeholder: 'sensor.battery_power',
          required: false,
          helpText:
            "For batteries and EVs only. The Entity ID above is the SoC percent sensor; this is an optional power sensor (W or kW) used for the power/charge history charts. When omitted, power history is left empty and the dashboard infers battery flow from SoC changes instead of reinterpreting percent values as kilowatts.",
        },
        {
          key: 'power_unit',
          label: 'Unit of Measurement',
          type: 'select',
          required: false,
          options: [
            { label: 'kW (kilowatts)', value: 'kW' },
            { label: 'W (watts)', value: 'W' },
          ],
          helpText:
            "The unit your entity reports in. If left blank, the entity's reported unit is used.",
        },
      ],
      setupInstructions:
        'Enable the Home Assistant REST API (enabled by default). Create a Long-Lived Access Token in your profile, then find the entity_id for this device in Settings → Devices & Services.',
    };
  }
}
