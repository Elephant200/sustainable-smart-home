/**
 * Emporia Vue Energy Monitor Adapter (Stub)
 *
 * Real API reference: Unofficial reverse-engineered API
 * Reference implementation: https://github.com/magico13/PyEmVue
 *
 * Auth: Username + password (Cognito-based token exchange)
 *   - Auth URL: https://cognito-idp.us-east-2.amazonaws.com/
 *   - Pool: us-east-2_ghlOXVLi1  (Emporia's Cognito User Pool)
 *   - Client ID: 4qte47jbstod8apnfic0bunmrq
 *
 * Key endpoints when live (all require id_token header):
 *   GET https://api.emporiaenergy.com/customers/devices
 *     -> devices[]: { deviceGid, locationProperties: { deviceName } }
 *   GET https://api.emporiaenergy.com/AppAPI?apiMethod=getDeviceListUsages
 *       &deviceGids=:gid&instant=:unix_ts&scale=1MIN&unit=KilowattHours
 *     -> deviceListUsages.devices[0].channels[0].usage (kWh for the interval)
 *
 * Note: Emporia does not provide an official public API. This adapter is
 * based on the community-reverse-engineered protocol and may break if
 * Emporia changes their backend. A Cognito SDK (amazon-cognito-identity-js)
 * is needed for the token exchange.
 *
 * connection_config shape:
 *   { username: string; password: string; device_gid: string }
 */

import {
  DeviceAdapter,
  DeviceCommand,
  DeviceRecord,
  DeviceStatus,
  HistoricalPoint,
  ConnectionSchema,
} from '../types';
import { SimulatedAdapter } from '../simulated';

export class EmporiaAdapter implements DeviceAdapter {
  readonly providerType = 'emporia' as const;
  private device: DeviceRecord;
  private fallback: SimulatedAdapter;

  constructor(device: DeviceRecord) {
    this.device = device;
    this.fallback = new SimulatedAdapter(device);
  }

  isConfigured(): boolean {
    const cfg = this.device.connection_config as {
      username?: string;
      password?: string;
      device_gid?: string;
    };
    return !!(cfg.username && cfg.password && cfg.device_gid);
  }

  async getStatus(): Promise<DeviceStatus> {
    if (!this.isConfigured()) {
      const simStatus = await this.fallback.getStatus();
      return { ...simStatus, providerType: 'emporia', isLive: false };
    }

    /**
     * LIVE IMPLEMENTATION (requires amazon-cognito-identity-js):
     *
     * Step 1 — obtain id_token via Cognito:
     *   const { CognitoUserPool, CognitoUser, AuthenticationDetails } =
     *     await import('amazon-cognito-identity-js');
     *   const pool = new CognitoUserPool({ UserPoolId: 'us-east-2_ghlOXVLi1', ClientId: '4qte47jbstod8apnfic0bunmrq' });
     *   const user = new CognitoUser({ Username: cfg.username, Pool: pool });
     *   const auth = new AuthenticationDetails({ Username: cfg.username, Password: cfg.password });
     *   const session = await new Promise<CognitoUserSession>((resolve, reject) =>
     *     user.authenticateUser(auth, { onSuccess: resolve, onFailure: reject })
     *   );
     *   const idToken = session.getIdToken().getJwtToken();
     *
     * Step 2 — fetch current usage:
     *   const now = Math.floor(Date.now() / 1000);
     *   const res = await fetch(
     *     `https://api.emporiaenergy.com/AppAPI?apiMethod=getDeviceListUsages` +
     *     `&deviceGids=${cfg.device_gid}&instant=${now}&scale=1MIN&unit=KilowattHours`,
     *     { headers: { authtoken: idToken } }
     *   );
     *   const json = await res.json();
     *   const usage = json.deviceListUsages?.devices?.[0]?.channels?.[0]?.usage ?? 0;
     *   return {
     *     deviceId: this.device.id,
     *     providerType: 'emporia',
     *     timestamp: new Date(now * 1000),
     *     isLive: true,
     *     houseLoadKw: usage * 60,  // kWh per minute → kW
     *   };
     */

    const simStatus = await this.fallback.getStatus();
    return { ...simStatus, providerType: 'emporia', isLive: false };
  }

  async getHistory(
    metric: string,
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalPoint[]> {
    if (!this.isConfigured()) {
      return this.fallback.getHistory(metric, startDate, endDate);
    }

    /**
     * LIVE IMPLEMENTATION:
     * Use the getDeviceListUsages endpoint with scale=1HR over the requested range.
     * See https://github.com/magico13/PyEmVue for example usage patterns.
     */

    return this.fallback.getHistory(metric, startDate, endDate);
  }

  async sendCommand(
    command: DeviceCommand
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
            'Your password is only used to obtain a session token and is never stored in plain text.',
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
