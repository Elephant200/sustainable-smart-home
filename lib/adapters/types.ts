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
    module_count?: number;
  };
  ev_config?: {
    battery_capacity_kwh: number;
    target_charge: number;
    departure_time: string;
    charger_power_kw: number;
  };
}

export interface BatteryModule {
  id: number;
  charge_pct: number;
  capacity_kwh: number;
  health_pct: number;
  temperature_f: number;
  power_kw: number;
  status: 'charging' | 'discharging' | 'idle';
}

export interface DeviceStatus {
  deviceId: string;
  providerType: ProviderType;
  timestamp: Date;
  solarOutputKw?: number;
  batterySOCPercent?: number;
  batterySOCKwh?: number;
  batteryPowerKw?: number;
  /** Total nameplate capacity reported by the provider, in kWh. */
  batteryCapacityKwh?: number;
  /** Maximum charge/discharge rate reported by the provider, in kW. */
  batteryMaxFlowKw?: number;
  /** Per-module breakdown for batteries (count derived per-device). */
  batteryModules?: BatteryModule[];
  /** Average health across modules; derived in the adapter so swapping to
   * a real provider yields the provider's reported health values. */
  batteryHealthPct?: number;
  evSOCPercent?: number;
  evChargeRateKw?: number;
  evPluggedIn?: boolean;
  houseLoadKw?: number;
  gridImportKw?: number;
  gridCarbonIntensity?: number;
  /** System-level energy flow edges. Populated by the grid adapter so the
   * snapshot route can render the energy-flow diagram without calling the
   * physics solver directly. */
  flowEdges?: { source: string; target: string; power_kw: number }[];
  /** System-level house load (kW) reported alongside grid status, derived
   * from the same flow solve. Lets the snapshot route avoid a second house
   * adapter call when it already has the grid status. Optional. */
  houseLoadKwSystem?: number;
  /** True when the values came from a successful live provider call. False
   * when the provider failed or this device has no configured provider; in
   * that case data fields will be absent (not simulated). */
  isLive: boolean;
  /** Human-readable explanation when isLive is false. Routes/UI should
   * surface this to the user (e.g. "Live data unavailable: HTTP 401").
   * The simulator never sets this. */
  error?: string;
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

/**
 * Callback invoked by an adapter when it rotates credentials (e.g. an OAuth
 * refresh) and the new plaintext payload should be encrypted and persisted
 * to the device's `connection_config` column. Server routes wire this
 * through `loadUserContext()`; client-only callers may omit it.
 */
export type CredentialPersister = (
  plaintext: Record<string, unknown>
) => Promise<void>;

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
