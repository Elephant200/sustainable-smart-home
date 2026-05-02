/**
 * Emporia Vue Energy Monitor Adapter
 *
 * Real API reference: Unofficial / community-documented (no public Emporia API).
 * Reference implementation: https://github.com/magico13/PyEmVue
 *
 * Auth: Username + password via AWS Cognito (us-east-2_ghlOXVLi1)
 *   - We exchange the username/password for an id_token, then use that token
 *     in the `authtoken` header on subsequent requests.
 *   - Tokens are cached in connection_config (id_token + expires_at) so a
 *     fresh login isn't needed on every poll.
 *
 * Endpoints used (all require the `authtoken` header):
 *   GET https://api.emporiaenergy.com/customers/devices
 *     -> devices[]: { deviceGid, locationProperties: { deviceName } }
 *   GET https://api.emporiaenergy.com/AppAPI?apiMethod=getDeviceListUsages
 *       &deviceGids=:gid&instant=:iso&scale=1MIN&unit=KilowattHours&energyDirection=CONSUMED
 *     -> deviceListUsages.devices[0].channelUsages[0].usage (kWh per minute)
 *
 * connection_config shape:
 *   { username: string; password: string; device_gid: string;
 *     id_token?: string; expires_at?: number }
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

interface EmporiaConnectionConfig {
  username?: string;
  password?: string;
  device_gid?: string;
  id_token?: string;
  expires_at?: number;
}

const REQUEST_TIMEOUT_MS = 12_000;
const APP_API = 'https://api.emporiaenergy.com';
const POOL_ID = 'us-east-2_ghlOXVLi1';
const CLIENT_ID = '4qte47jbstod8apnfic0bunmrq';

interface CognitoSession {
  getIdToken(): { getJwtToken(): string; getExpiration(): number };
}

interface CognitoUserPoolType {
  new (config: { UserPoolId: string; ClientId: string }): unknown;
}
interface CognitoUserType {
  new (config: { Username: string; Pool: unknown }): {
    authenticateUser(
      auth: unknown,
      callbacks: {
        onSuccess: (s: CognitoSession) => void;
        onFailure: (err: Error) => void;
      }
    ): void;
  };
}
interface AuthenticationDetailsType {
  new (config: { Username: string; Password: string }): unknown;
}

export class EmporiaAdapter implements DeviceAdapter {
  readonly providerType = 'emporia' as const;
  private device: DeviceRecord;
  private persister?: CredentialPersister;
  private inMemoryConfig: EmporiaConnectionConfig;

  constructor(device: DeviceRecord, persister?: CredentialPersister) {
    this.device = device;
    this.persister = persister;
    this.inMemoryConfig = { ...(device.connection_config as EmporiaConnectionConfig) };
  }

  isConfigured(): boolean {
    return hasStoredCredentials(this.device.connection_config, [
      'username',
      'password',
      'device_gid',
    ]);
  }

  /**
   * Returns an "unavailable" status with no data fields populated when a
   * live Emporia/Cognito call fails. Real-provider devices MUST NEVER fall
   * back to simulator output; routes / UI surface `isLive=false` and the
   * `error` reason so users see the outage instead of a fabricated value.
   */
  private unavailableStatus(reason: string): DeviceStatus {
    if (reason)
      console.warn(
        `[emporia] ${this.device.name}: live data unavailable — ${reason}`
      );
    return {
      deviceId: this.device.id,
      providerType: 'emporia',
      timestamp: new Date(),
      isLive: false,
      error: reason || 'Emporia credentials not configured',
    };
  }

  /**
   * Cognito authentication: exchanges username+password for an id_token.
   * Cached in connection_config (with expires_at) and persisted via the
   * configured callback so subsequent requests reuse the token.
   */
  private async authenticateCognito(): Promise<string> {
    const cfg = this.inMemoryConfig;
    if (!cfg.username || !cfg.password) {
      throw new Error('Emporia username/password not configured');
    }
    // Dynamic import: keeps the package out of any client bundle that
    // happens to walk the adapter graph for schemas.
    const cognito = (await import('amazon-cognito-identity-js')) as unknown as {
      CognitoUserPool: CognitoUserPoolType;
      CognitoUser: CognitoUserType;
      AuthenticationDetails: AuthenticationDetailsType;
    };

    const pool = new cognito.CognitoUserPool({
      UserPoolId: POOL_ID,
      ClientId: CLIENT_ID,
    });
    const user = new cognito.CognitoUser({ Username: cfg.username, Pool: pool });
    const auth = new cognito.AuthenticationDetails({
      Username: cfg.username,
      Password: cfg.password,
    });

    const session = await new Promise<CognitoSession>((resolve, reject) => {
      user.authenticateUser(auth, {
        onSuccess: resolve,
        onFailure: (err) => reject(err),
      });
    });
    const idToken = session.getIdToken().getJwtToken();
    const expiresAt = session.getIdToken().getExpiration(); // unix seconds

    const newCfg: EmporiaConnectionConfig = {
      ...cfg,
      id_token: idToken,
      expires_at: expiresAt,
    };
    this.inMemoryConfig = newCfg;
    if (this.persister) {
      try {
        await this.persister(newCfg as Record<string, unknown>);
      } catch (err) {
        console.warn(
          `[emporia] ${this.device.name}: failed to persist id_token — ${
            err instanceof Error ? err.message : 'unknown'
          }`
        );
      }
    }
    return idToken;
  }

  /**
   * Returns a valid id_token, reusing the cached one when not expired
   * (with a 60s safety margin). Otherwise re-authenticates.
   */
  private async getIdToken(): Promise<string> {
    const cfg = this.inMemoryConfig;
    const nowSec = Math.floor(Date.now() / 1000);
    if (cfg.id_token && cfg.expires_at && cfg.expires_at - 60 > nowSec) {
      return cfg.id_token;
    }
    return this.authenticateCognito();
  }

  private async eFetch(path: string): Promise<Response> {
    const token = await this.getIdToken();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${APP_API}${path}`, {
        headers: { authtoken: token },
        cache: 'no-store',
        signal: ctrl.signal,
      });
      if (res.status === 401) {
        // Cached token rejected — force re-auth and retry once.
        this.inMemoryConfig = { ...this.inMemoryConfig, id_token: undefined, expires_at: undefined };
        const fresh = await this.getIdToken();
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), REQUEST_TIMEOUT_MS);
        try {
          return await fetch(`${APP_API}${path}`, {
            headers: { authtoken: fresh },
            cache: 'no-store',
            signal: ctrl2.signal,
          });
        } finally {
          clearTimeout(t2);
        }
      }
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) return this.unavailableStatus('');
    const cfg = this.inMemoryConfig;
    if (!cfg.device_gid) return this.unavailableStatus('device_gid not set');

    try {
      const instant = new Date().toISOString();
      const path =
        `/AppAPI?apiMethod=getDeviceListUsages` +
        `&deviceGids=${encodeURIComponent(cfg.device_gid)}` +
        `&instant=${encodeURIComponent(instant)}` +
        `&scale=1MIN&unit=KilowattHours&energyDirection=CONSUMED`;
      const res = await this.eFetch(path);
      if (!res.ok)
        return this.unavailableStatus(`getDeviceListUsages HTTP ${res.status}`);
      const json = (await res.json()) as {
        deviceListUsages?: {
          devices?: Array<{
            channelUsages?: Array<{ usage?: number; channelNum?: string }>;
          }>;
        };
      };
      const usages = json.deviceListUsages?.devices?.[0]?.channelUsages ?? [];
      // Channel "1,2,3" is the whole-home aggregate on the Vue.
      const main = usages.find((c) => c.channelNum === '1,2,3') ?? usages[0];
      const kwhPerMinute = main?.usage ?? 0;
      const houseLoadKw = kwhPerMinute * 60; // kWh/min → kW

      const status: DeviceStatus = {
        deviceId: this.device.id,
        providerType: 'emporia',
        timestamp: new Date(),
        isLive: true,
      };
      if (this.device.type === 'house' || this.device.type === 'grid') {
        status.houseLoadKw = houseLoadKw;
        if (this.device.type === 'grid') {
          // Emporia's whole-home channel reports consumption from the panel;
          // when there's no on-site generation feedback (Vue alone has none),
          // grid_import equals consumption.
          status.gridImportKw = houseLoadKw;
          status.houseLoadKwSystem = houseLoadKw;
        }
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
    const cfg = this.inMemoryConfig;
    if (!cfg.device_gid) return [];

    try {
      const path =
        `/AppAPI?apiMethod=getChartUsage` +
        `&deviceGid=${encodeURIComponent(cfg.device_gid)}` +
        `&channel=1,2,3` +
        `&start=${encodeURIComponent(range.startDate.toISOString())}` +
        `&end=${encodeURIComponent(range.endDate.toISOString())}` +
        `&scale=1H&unit=KilowattHours&energyDirection=CONSUMED`;
      const res = await this.eFetch(path);
      if (!res.ok) {
        console.warn(
          `[emporia] ${this.device.name}: history HTTP ${res.status}; returning empty`
        );
        return [];
      }
      const json = (await res.json()) as {
        firstUsageInstant?: string;
        usageList?: Array<number | null>;
      };
      const start = json.firstUsageInstant
        ? new Date(json.firstUsageInstant).getTime()
        : range.startDate.getTime();
      const list = json.usageList ?? [];
      const HOUR_MS = 3600_000;
      return list
        .map((v, i) => ({
          timestamp: new Date(start + i * HOUR_MS),
          value: v == null ? 0 : v,
          unit: 'kWh',
        }))
        .filter((pt) => pt.timestamp <= range.endDate);
    } catch (err) {
      console.warn(
        `[emporia] ${this.device.name}: history fetch failed — ${
          err instanceof Error ? err.message : 'unknown'
        }; returning empty`
      );
      return [];
    }
  }

  async sendCommand(
    _command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }> {
    return {
      success: false,
      message: 'Emporia Vue API is read-only; control commands are not supported',
    };
  }

  getConnectionSchema(): ConnectionSchema {
    return {
      providerType: 'emporia',
      displayName: 'Emporia Vue',
      description:
        'Connect an Emporia Vue whole-home energy monitor via the Emporia cloud API.',
      authMethod: 'username_password',
      fields: [
        {
          key: 'username',
          label: 'Emporia Account Email',
          type: 'text',
          placeholder: 'you@example.com',
          required: true,
          helpText: 'The email address you use to log in to the Emporia app.',
        },
        {
          key: 'password',
          label: 'Emporia Account Password',
          type: 'password',
          placeholder: 'Your Emporia app password',
          required: true,
          helpText:
            'Used to obtain a Cognito session token. Stored encrypted at rest.',
        },
        {
          key: 'device_gid',
          label: 'Device GID',
          type: 'text',
          placeholder: 'e.g. 1234567',
          required: true,
          helpText:
            'Your Emporia Vue device ID. Retrieve via GET /customers/devices after authenticating.',
        },
      ],
      setupInstructions:
        'Install the Emporia app, set up your Vue monitor, then use your account credentials here. Note: Emporia does not provide an official API — this integration uses the community-documented protocol.',
    };
  }
}
