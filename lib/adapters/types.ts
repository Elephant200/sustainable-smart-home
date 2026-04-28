export type ProviderType =
  | 'simulated'
  | 'tesla'
  | 'enphase'
  | 'home_assistant'
  | 'solaredge'
  | 'emporia';

export type DeviceKind = 'solar_array' | 'battery' | 'ev' | 'grid' | 'house';

export interface DeviceRecord {
  id: string;
  user_id: string;
  name: string;
  type: DeviceKind;
  is_active: boolean;
  provider_type: ProviderType;
  connection_config: Record<string, unknown>;
  solar_config?: {
    panel_count: number;
    output_per_panel_kw: number;
  };
  battery_config?: {
    capacity_kwh: number;
    max_flow_kw: number;
  };
  ev_config?: {
    battery_capacity_kwh: number;
    target_charge: number;
    departure_time: string;
    charger_power_kw: number;
  };
}

export interface DeviceStatus {
  deviceId: string;
  providerType: ProviderType;
  timestamp: Date;
  solarOutputKw?: number;
  batterySOCPercent?: number;
  batterySOCKwh?: number;
  batteryPowerKw?: number;
  evSOCPercent?: number;
  evChargeRateKw?: number;
  evPluggedIn?: boolean;
  houseLoadKw?: number;
  gridImportKw?: number;
  gridCarbonIntensity?: number;
  isLive: boolean;
}

export interface HistoricalPoint {
  timestamp: Date;
  value: number;
  unit: string;
}

/**
 * Range argument for getHistory(). A single object parameter keeps the
 * interface extensible (new fields can be added without breaking callers).
 */
export interface HistoryRange {
  metric: string;
  startDate: Date;
  endDate: Date;
}

export interface DeviceCommand {
  type:
    | 'set_charge_limit'
    | 'set_discharge_limit'
    | 'set_target_soc'
    | 'custom';
  payload: Record<string, unknown>;
}

export interface ConnectionFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  required: boolean;
  options?: { label: string; value: string }[];
  helpText?: string;
}

export interface ConnectionSchema {
  providerType: ProviderType;
  displayName: string;
  description: string;
  authMethod:
    | 'none'
    | 'api_key'
    | 'bearer_token'
    | 'local_token'
    | 'oauth2_pkce'
    | 'oauth2'
    | 'username_password';
  fields: ConnectionFieldSchema[];
  setupInstructions?: string;
}

/**
 * Returns true if a connection_config object indicates that credentials have
 * been stored, regardless of whether the calling context is client-side
 * (masked form) or server-side (encrypted form or plain fields).
 *
 * - Client GET response: { is_configured: true }
 * - Server DB row:       { __encrypted: "iv:tag:ciphertext" }
 * - Dev/test plain:      { some_field: "value", ... }
 */
export function hasStoredCredentials(
  cfg: Record<string, unknown>,
  requiredFields: string[]
): boolean {
  if (cfg.is_configured === true) return true;
  if (typeof cfg.__encrypted === 'string' && cfg.__encrypted.length > 0)
    return true;
  return requiredFields.every((f) => typeof cfg[f] === 'string' && !!cfg[f]);
}

export interface DeviceAdapter {
  readonly providerType: ProviderType;

  getStatus(): Promise<DeviceStatus>;

  /**
   * Retrieve historical time-series data for a device metric.
   * @param range - Contains metric name, startDate, and endDate.
   */
  getHistory(range: HistoryRange): Promise<HistoricalPoint[]>;

  sendCommand(
    command: DeviceCommand
  ): Promise<{ success: boolean; message?: string }>;

  getConnectionSchema(): ConnectionSchema;

  isConfigured(): boolean;
}
