# Provider Adapters — Field Mapping & Integration Guide

This directory contains one adapter per real-hardware provider. Each adapter implements `DeviceAdapter` (`lib/adapters/types.ts`) and translates provider-specific API responses into the shared `DeviceStatus` and `HistoricalPoint` shapes.

---

## DeviceStatus / HistoricalPoint contracts

| DeviceStatus field | Type | Meaning |
|---|---|---|
| `deviceId` | string (UUID) | DB row id of the device |
| `providerType` | ProviderType | Which adapter produced this reading |
| `timestamp` | Date | When the reading was taken |
| `isLive` | boolean | True = real provider data; false = provider unavailable |
| `error` | string? | Human-readable reason when isLive is false |
| `solarOutputKw` | number? | Current solar generation (kW) |
| `batterySOCPercent` | number? | Battery state of charge (0–100 %) |
| `batterySOCKwh` | number? | Battery energy remaining (kWh) |
| `batteryPowerKw` | number? | Battery charge (+) / discharge (−) flow (kW) |
| `batteryCapacityKwh` | number? | Nameplate capacity (kWh) |
| `batteryMaxFlowKw` | number? | Maximum charge/discharge rate (kW) |
| `houseLoadKw` | number? | Instantaneous home consumption (kW) |
| `gridImportKw` | number? | Grid import (positive) / export (negative) (kW) |
| `evSOCPercent` | number? | EV battery state of charge (0–100 %) |
| `evChargeRateKw` | number? | Current EV charge rate (kW) |
| `evPluggedIn` | boolean? | Whether EV is plugged in |

`HistoricalPoint` carries `{ timestamp: Date; value: number; unit: string }`.

---

## Tesla (`tesla.ts`)

**Auth:** OAuth2 PKCE. See `/api/auth/oauth/tesla/start` → `/api/auth/oauth/tesla/callback`.  
**Polling cadence:** 1 request / minute per site endpoint (Fleet API recommendation).  
**Rate limit backoff:** 300 s on HTTP 429.

### connection_config fields

| Field | Description |
|---|---|
| `access_token` | Bearer token for Fleet API calls |
| `refresh_token` | Used to get a new access_token (expires_in usually 8h) |
| `expires_at` | Unix seconds when access_token expires |
| `site_id` | Powerwall energy site ID (from `/api/1/products`) |
| `vehicle_id` | Numeric vehicle ID for EV status endpoint |
| `vin` | 17-char VIN for EV charging-history endpoint |
| `client_id` | OAuth app client_id (falls back to TESLA_CLIENT_ID env) |
| `region` | `'na'` / `'eu'` / `'cn'` — maps to allowlisted Fleet API host |

### Raw → DeviceStatus mapping

| Provider field | Path | DeviceStatus field | Notes |
|---|---|---|---|
| `solar_power` | `live_status.response` | `solarOutputKw` | Watts → kW (÷1000) |
| `battery_power` | `live_status.response` | `batteryPowerKw` | Watts → kW; sign-flipped (Tesla: positive=discharge, ours: positive=charge) |
| `percentage_charged` | `live_status.response` | `batterySOCPercent` | 0–100 |
| `energy_left` | `live_status.response` | `batterySOCKwh` | Wh → kWh (÷1000) |
| `total_pack_energy` | `live_status.response` | `batteryCapacityKwh` | Wh → kWh |
| `load_power` | `live_status.response` | `houseLoadKw` | Watts → kW |
| `grid_power` | `live_status.response` | `gridImportKw` | Watts → kW (positive=import) |
| `charge_state.battery_level` | `vehicle_data.response` | `evSOCPercent` | % |
| `charge_state.charger_power` | `vehicle_data.response` | `evChargeRateKw` | Already kW |
| `charge_state.charging_state` | `vehicle_data.response` | `evPluggedIn` | `!== 'Disconnected'` |

### HistoricalPoint mapping (energy site)

| `device.type` | `metric` | Tesla kind | Field extracted |
|---|---|---|---|
| `solar_array` | `energy_kwh` | `energy` | `solar_energy_exported` (Wh → kWh) |
| `solar_array` | `power_kw` | `power` | `solar_power` (W → kW) |
| `battery` | `power_kw` | `power` | `battery_power` (W → kW; sign-flipped) |
| `battery` | `soc_kwh` / `soc_percent` | `soe` | `soe` field (%, converted to kWh using capacity) |
| `house` | `energy_kwh` | `energy` | `consumer_energy_imported` (Wh → kWh) |
| `house` | `power_kw` | `power` | `load_power` (W → kW) |
| `grid` | `energy_kwh` | `energy` | `grid_energy_imported − grid_energy_exported_from_solar` (Wh → kWh) |
| `grid` | `grid_kw` | `power` | `grid_power` (W → kW) |

EV history uses `/api/1/dx/vehicles/charging/history` keyed on VIN; sessions are overlap-weighted into hourly kWh buckets.

---

## Enphase (`enphase.ts`)

**Auth:** OAuth2 authorization-code. See `/api/auth/oauth/enphase/start` → `/api/auth/oauth/enphase/callback`.  
**Polling cadence:** 15 minutes (telemetry endpoints update at 15-min granularity).  
**Rate limit backoff:** 1800 s on HTTP 429.

### connection_config fields

| Field | Description |
|---|---|
| `api_key` | App API key (sent as query param `key=`) |
| `access_token` | OAuth2 bearer token |
| `refresh_token` | Used to refresh access_token |
| `expires_at` | Unix seconds expiry |
| `system_id` | Enphase system ID (from `/api/v4/systems`) |
| `client_id` | OAuth client_id (falls back to ENPHASE_CLIENT_ID env) |
| `client_secret` | OAuth client_secret (falls back to ENPHASE_CLIENT_SECRET env) |

### Raw → DeviceStatus mapping

| Provider endpoint | Field | DeviceStatus field | Notes |
|---|---|---|---|
| `/api/v4/systems/:id/summary` | `current_power` | `solarOutputKw` | W → kW |
| `/api/v4/systems/:id/telemetry/battery` | `intervals[-1].soc.percent` | `batterySOCPercent` | 0–100 |
| battery telemetry | `intervals[-1].charge.enwh − discharge.enwh` | `batteryPowerKw` | Wh / 0.25h = kW (15-min interval) |

House and grid status are not available via Enphase summary; those device types return `isLive: false`.

### HistoricalPoint mapping

| `device.type` | `metric` | Endpoint | Field |
|---|---|---|---|
| `solar_array` | `energy_kwh` | `production_micro` | `intervals[].enwh` (Wh → kWh) |
| `battery` | `soc_percent` | `telemetry/battery` | `intervals[].soc.percent` |
| `battery` | `soc_kwh` | `telemetry/battery` | `soc.percent × capacity` |
| `battery` | `power_kw` | `telemetry/battery` | `(charge.enwh − discharge.enwh) / interval_hours` |

For ranges > 7 days `granularity=day` is used and each daily sample is expanded to 24 hourly samples.

---

## SolarEdge (`solaredge.ts`)

**Auth:** API key (query parameter `api_key=`). No OAuth.  
**Polling cadence:** 15 minutes (300 req/day limit ≈ 1/4.8min; 15 min leaves comfortable headroom).  
**Rate limit backoff:** 1800 s on HTTP 429.

### connection_config fields

| Field | Description |
|---|---|
| `api_key` | SolarEdge Monitoring API key |
| `site_id` | Numeric site ID (from monitoring portal URL) |

### Raw → DeviceStatus mapping

All from `GET /site/:id/currentPowerFlow`:

| Provider field | DeviceStatus field | Notes |
|---|---|---|
| `PV.currentPower` (unit) | `solarOutputKw` | Converted to kW via `toKw(value, unit)` |
| `STORAGE.chargeLevel` | `batterySOCPercent` | % |
| `STORAGE.currentPower` × sign | `batteryPowerKw` | Sign determined by `STORAGE.status` (Charging/Discharging) |
| `LOAD.currentPower` | `houseLoadKw` | kW |
| `GRID.currentPower` | `gridImportKw` | kW |

### HistoricalPoint mapping

| `device.type` | `metric` | Endpoint | Notes |
|---|---|---|---|
| `solar_array` | `energy_kwh` | `/site/:id/energy?timeUnit=HOUR` | `energy.values[].value` |
| `solar_array` | `power_kw` | `/site/:id/powerDetails?meters=PRODUCTION` | W → kW |
| `house` | `energy_kwh` | `/site/:id/energyDetails?meters=CONSUMPTION` | Wh → kWh |
| `house` | `power_kw` | `/site/:id/powerDetails?meters=CONSUMPTION` | W → kW |
| `grid` | `energy_kwh` | `/site/:id/energyDetails?meters=PURCHASED,FEEDIN` | `(purchased − feedin)` Wh → kWh |
| `grid` | `grid_kw` | `/site/:id/powerDetails?meters=PURCHASED,FEEDIN` | signed kW |
| `battery` | `soc_percent` / `soc_kwh` | `/site/:id/storageData` | `telemetries[].batteryPercentageState` |
| `battery` | `power_kw` | `/site/:id/storageData` | `telemetries[].power` W → kW (sign-flipped) |

---

## Emporia Vue (`emporia.ts`)

**Auth:** Username + password via AWS Cognito (pool `us-east-2_ghlOXVLi1`). Tokens cached in connection_config.  
**Polling cadence:** 5 minutes (unofficial API, no published limit).  
**Rate limit backoff:** 900 s on HTTP 429.

### connection_config fields

| Field | Description |
|---|---|
| `username` | Emporia account email |
| `password` | Emporia account password |
| `device_gid` | Numeric device GID (from `/customers/devices`) |
| `id_token` | Cached Cognito id_token |
| `expires_at` | Unix seconds expiry of cached token |

### Raw → DeviceStatus mapping

From `GET /AppAPI?apiMethod=getDeviceListUsages`:

| Provider field | DeviceStatus field | Notes |
|---|---|---|
| `deviceListUsages.devices[0].channelUsages[ch="1,2,3"].usage` | `houseLoadKw` | kWh/min × 60 = kW |

### HistoricalPoint mapping

From `GET /AppAPI?apiMethod=getChartUsage&scale=1H`:

| Field | Notes |
|---|---|
| `usageList[i]` | kWh per hour, indexed from `firstUsageInstant` |

---

## Home Assistant (`home-assistant.ts`)

**Auth:** Long-lived access token (Bearer). No OAuth.  
**Polling cadence:** 30 seconds (self-hosted, no external quota).  
**Rate limit backoff:** 120 s on HTTP 429.

### connection_config fields

| Field | Description |
|---|---|
| `base_url` | HA instance base URL (validated against SSRF guard) |
| `token` | Long-lived access token |
| `entity_id` | Primary sensor (power W/kW for solar/house/grid; SoC % for battery/EV) |
| `energy_entity_id` | Optional cumulative energy sensor (kWh) for historical totals |
| `power_entity_id` | Optional power sensor for battery/EV power readings |
| `power_unit` | Hint: `'W'` or `'kW'` when entity omits unit_of_measurement |

### Raw → DeviceStatus mapping

From `GET /api/states/:entity_id`:

| Device type | `entity_id` maps to | `power_entity_id` maps to |
|---|---|---|
| `solar_array` | `solarOutputKw` (power sensor W/kW) | — |
| `house` | `houseLoadKw` (power sensor W/kW) | — |
| `grid` | `gridImportKw` (power sensor W/kW) | — |
| `battery` | `batterySOCPercent` (% sensor) | `batteryPowerKw` (power sensor W/kW) |
| `ev` | `evSOCPercent` (% sensor) | `evChargeRateKw` (power sensor W/kW) |

SSRF guard blocks AWS/GCP metadata IPs always; blocks RFC1918/loopback in production unless `HOME_ASSISTANT_ALLOWED_HOSTS` allows them.

---

## How to add a new provider

1. **Create `lib/adapters/providers/<name>.ts`** implementing `DeviceAdapter`:
   - `readonly providerType = '<name>' as const`
   - `isConfigured()` — check required connection_config fields
   - `getStatus()` — return `DeviceStatus`; set `isLive: true` on success, call `unavailableStatus(reason)` on failure (never fall back to simulator)
   - `getHistory(range)` — return `HistoricalPoint[]`; return `[]` on failure (never fabricate)
   - `sendCommand(command)` — return `{ success: false, message: '...' }` if not supported
   - `getConnectionSchema()` — define the `ConnectionSchema` for the UI

2. **Add to `ProviderType`** (`lib/adapters/types.ts`) and the Supabase enum.

3. **Register in `createAdapter`** (`lib/adapters/factory.ts`).

4. **Add `ConnectionSchema.authMethod`**:
   - `'api_key'` — API key in query param or header
   - `'bearer_token'` — static bearer token
   - `'oauth2_pkce'` — OAuth2 with PKCE (add entry to `OAUTH_PROVIDERS` in `lib/server/oauth-providers.ts`)
   - `'oauth2'` — OAuth2 authorization-code (add entry to `OAUTH_PROVIDERS`)
   - `'username_password'` — username + password (implement token fetch inside adapter)
   - `'local_token'` — long-lived token (no standard OAuth)

5. **Add polling cadence** in `lib/server/polling-config.ts`.

6. **Add field mapping table** to this README.

7. **Run `supabase/migrations/`** to add the new enum value if you added it to `ProviderType`.
