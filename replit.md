# Sustainable Smart Home — replit.md

## Overview

Sustainable Smart Home is a Next.js 15 web application for monitoring and managing residential energy systems. It provides a dashboard for tracking solar panel generation, battery storage, EV charging, and grid interaction. The platform supports **live data** from real hardware via provider adapters (Tesla Fleet API, Enphase Enlighten v4, SolarEdge Monitoring API, Home Assistant REST, Emporia Vue) and **simulated data** for users who explicitly add a device with `provider_type === 'simulated'`. The simulator is **only** invoked for those user-added simulated devices — there is no implicit per-role fallback. Roles the user hasn't configured at all (no real and no simulated device) surface as empty states in the UI that point the user at Settings; live-provider failures contribute zero with `isLive:false` and never trigger simulator output.

Key user-facing areas:
- Public landing page with feature marketing
- Authenticated dashboard (`/app`) with sidebar navigation
- Sub-pages: Solar, Battery, EV Charging, Analytics, Alerts, Settings
- Settings: device configuration, location, notifications, account management

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework**: Next.js 15 (App Router) with React 19 and TypeScript 5
- **Styling**: Tailwind CSS 3 with CSS custom properties for theming; dark/light mode via `next-themes`
- **Component library**: shadcn/ui (new-york style) backed by Radix UI primitives
- **Icons**: Lucide React
- **Charts/Visualizations**: Recharts wrapped in shadcn `ChartContainer`
- **Animations**: Framer Motion for page transitions and route progress bar
- **Fonts**: Inter (sans) + Fraunces (display, serif headings) via `next/font/google`
- **Design language**: "Organic & earthy" — forest greens (primary), terra cotta (accent), warm linen/cream surfaces in light mode, deep soil with bioluminescent accents in dark mode. All UI uses semantic tokens (`primary`, `accent`, `chart-1..5`, `destructive`, `warning`, `secondary`, `muted`) defined in `app/globals.css`; hardcoded Tailwind palette classes (e.g. forbidden `text-X-600`, `bg-X-100`) are not used. This is enforced by `scripts/check-no-hardcoded-colors.mjs`, which runs first in `npm run lint` (which then runs `eslint .`) and is also exposed standalone as `npm run lint:colors`. The script walks the whole repo (skipping `node_modules`, `.next`, `.git`, `dist`, `build`, `.turbo`, `.cache`, `coverage`, `.vercel`, `.local`, `.upm`, `out`, `public`), scans `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mdx`, `.html`, `.htm`, `.css`, `.scss`, `.sass`, `.less`, `.pcss`, `.postcss`, `.vue`, `.svelte`, and `.astro` files, and fails the build if any palette class matching `(bg|text|border|from|to|via|ring|outline|fill|stroke|divide|placeholder|caret|accent|shadow|decoration|ring-offset)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|gray|slate|zinc|neutral|stone)-(50|[1-9]00|950)` is found outside the allowlisted `app/globals.css` and `tailwind.config.ts`. Plain `.md` files (docs, READMEs) are intentionally not scanned so contributor docs can mention the forbidden classes verbatim.

**Route structure**:
- `/` — Public landing page (`app/page.tsx`)
- `/auth/*` — Login, sign-up, password reset, delete account
- `/app/*` — Protected dashboard (layout enforces auth, redirects to `/auth/login`)
- `/app/settings` — Device config, location, account

**Layout pattern**: The dashboard layout (`app/app/layout.tsx`) is a server component that checks Supabase auth and renders a side-nav + topbar shell. Page content is wrapped in `PageTransition` (Framer Motion) for smooth navigation.

### Backend / API

- All server-side logic runs via **Next.js Route Handlers** (API routes under `app/`) and **Server Components**
- Supabase is used directly from server components and route handlers via `@supabase/ssr`
- Middleware (`middleware.ts`) calls `updateSession` on every request (except static assets) to keep Supabase auth sessions fresh

### Data Layer

- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password; password reset via email link)
- **ORM**: Direct Supabase JS client queries (no Drizzle or Prisma)

**Key tables** (from `supabase/schema_desc.md`):
| Table | Purpose |
|---|---|
| `profiles` | User profile, location (`city`, `state`, `zone_key`, `lat`, `long`), setup status |
| `devices` | Registry of energy devices (type: `solar_array`, `battery`, `ev`, `grid`, `house`) |
| `solar_config` | Panel count and per-panel output for solar devices |
| `battery_config` | Capacity and max flow for batteries |
| `battery_state` | Real-time SOC tracking |
| `ev_config` | EV battery size, target charge, departure time, charger power |
| `power_generation` | Time-series solar/wind generation records |
| `energy_flows` | Time-series power flow records |

**Credential security**: Device `connection_config` (API keys, tokens for real hardware providers) is encrypted at rest using AES-256-GCM (`lib/crypto/connection-config.ts`). The encryption key is read from `CONNECTION_CONFIG_SECRET` env var (64-char hex / 32 bytes). A dev fallback is used if unset, with a warning.

### Device Adapter Pattern

`lib/adapters/` implements a provider abstraction:
- `DeviceAdapter` interface: `getStatus()`, `getHistory()`, `sendCommand()`, `getConnectionSchema()`, `isConfigured()`
- `SimulatedAdapter` — default; generates realistic fake data
- Live adapters: `TeslaAdapter` (Fleet API w/ OAuth refresh-on-401), `EnphaseAdapter` (Enlighten v4 w/ OAuth refresh-on-401), `HomeAssistantAdapter` (REST + Bearer token), `SolarEdgeAdapter` (Monitoring API + API key), `EmporiaAdapter` (Cognito user-pool auth, id_token cached on the device row)
- `createAdapter(device, ctx)` factory selects the right adapter based on `device.provider_type`. **Live adapters never fall back to simulator output.** On network/HTTP/timeout errors (or unsupported `device.type` × `range.metric` combinations) they return `isLive:false` + an `error` reason from `getStatus()` and an empty array from `getHistory()` — never fabricated values. The simulator is only ever used for devices the user has explicitly added with `provider_type === 'simulated'` (which routes through `SimulatedAdapter`). There is no implicit per-role fallback: roles with no configured device contribute zero and the calling page surfaces an empty state pointing at Settings.
- **HomeAssistant SSRF guard**: `validateHomeAssistantUrl()` blocks AWS/GCP IMDS metadata IPs always, and blocks RFC1918 / loopback / link-local addresses in production unless explicitly allowlisted via `HOME_ASSISTANT_ALLOWED_HOSTS` (comma-separated host list). All HA fetches use `redirect: 'manual'` so a 30x cannot redirect to an internal address.

### Adapter-driven flow series

`lib/server/adapter-flows.ts` exposes two complementary helpers. `solveFlowsHistoryFromAdapters` builds the dashboard's hourly `SolvedFlows[]` series by reading `getHistory()` from each configured device, bucketing per-device samples into ISO hours, and feeding the resulting per-class snapshots into the pure `allocateFlowEdges()` allocator extracted from `lib/simulation/flows.ts`. `solveCurrentFlowFromAdapters` instead derives a single "current" `SolvedFlows` from per-device `getStatus()` calls (NOT the last history bucket) so providers that expose live status but no per-hour series — most notably Tesla EVs, where `getHistory()` returns `[]` — still populate Analytics, Alerts, and Solar "current" panels with real values, and so sub-hourly state changes (battery flipping charge/discharge, EV plug-in mid-hour) appear immediately rather than waiting for the next hour boundary. Per-role behavior matches `/api/energy/snapshot` exactly. Bucket aggregation is metric-aware: cumulative-energy series (`energy_kwh`) **sum** sub-hourly samples (additive deltas), instantaneous power/rate series (`power_kw`, `charge_kw`) are **averaged** within the hour, and level snapshots (`soc_kwh`) take the **last** sample of the hour — providers like Enphase return 15-min telemetry, so naïve summing would multiply true values 4×–60×. Battery `power_kw` is taken from the adapter when reported; otherwise it's derived from the SoC-kWh delta but ONLY when the current AND previous hour each have a complete SoC sample from every configured battery (a missing bucket leaves `power_kw` at 0 instead of emitting a fake multi-kW spike from a `null → value` transition). **Neither helper ever invokes the simulator as a fallback for missing roles or empty hours** — roles with no configured device contribute zero, and a real provider whose history call returned `[]` for an hour also contributes zero so the outage is visible. The Flows, Analytics, Alerts, and Solar/Panels routes all consume this adapter-driven series.

The **Snapshot route** uses `pickHouseDevice` / `pickGridDevice` (in `lib/server/system-devices.ts`), which return `DeviceRecord | null` — the user's configured device when present, otherwise `null`. Routes branch on `null` and respond with `house: null` / `grid: null` / `has_house: false` so the dashboard can render an empty state directing the user to Settings rather than show a fabricated value. Whole-home `house_kw` is sourced in priority order: (1) a real (or user-added simulated) house adapter status, (2) a real grid adapter that exposes `houseLoadKwSystem` (e.g. SolarEdge `currentPowerFlow.LOAD`, Tesla `live_status.load_power`), (3) zero. The signed `grid_kw` and the `flowEdges[]` array are always recomputed centrally via `allocateFlowEdges()` from the per-class power values — adapter-supplied edge graphs are never trusted, so the snapshot stays self-consistent regardless of which providers are connected.

**Per-role empty-state contracts**: `/api/energy/house/history` returns `has_house: false` + `points: []` when no house device is configured. `/api/energy/battery` exposes `critical_load_kw: null` + `backup_mode_label: null` when there's no house device to derive overnight runtime from (it never falls back to the simulator's house-load model). `/api/energy/solar/panels` emits `weather_factor: null` for real-provider arrays (the per-array irradiance model is a simulator construct that no real provider exposes) and `is_live: false` when an adapter status call failed; `current_kw` stays at 0 in that case rather than being substituted from `computeSolarArrayInstant`. `/api/energy/analytics` and `/api/energy/alerts` only feed `computeSolarArrayInstant` to `deriveAlerts` / `panelOptimalRatio` for arrays whose `provider_type === 'simulated'`, so the panel-condition alert is skipped (rather than computed against fake per-panel telemetry) for real providers. `/api/energy/ev` skips the grid-history fetch entirely when no grid device is configured, which causes the "clean energy %" calculation to degrade gracefully (treating every hour as 0 grid_kw) instead of being inflated by a fabricated baseline.

**Home Assistant cumulative-meter handling**: HA energy entities are typically cumulative kWh meters (e.g. 100 → 101 → 102). `HomeAssistantAdapter.getHistory()` for `energy_kwh` sorts the raw samples by timestamp and emits per-interval **deltas** (so the downstream bucket-summer doesn't double-, triple-, …-count cumulative readings). Negative deltas — meter resets, device replacements, explicit zeros on power loss — are skipped for that interval but the prev cursor is still advanced so the next interval is measured against the post-reset baseline rather than producing a fabricated spike.

**Enphase daily-aggregate expansion**: For ranges over 7 days `EnphaseAdapter.getHistory()` requests `granularity=day` from the Enlighten v4 telemetry API (a 7-month window at 15-min resolution would be ~20k intervals per system). Each daily sample is then **expanded into 24 hourly samples** before being returned, so the downstream hourly walker in `solveFlowsHistoryFromAdapters` doesn't collapse a whole day's energy into one ISO-hour bucket and surface it as a 100+ kW spike on the Analytics 3m/1y views. Solar production splits the day's kWh evenly across 24 hours (totals preserved). Battery SoC level snapshots replicate the end-of-day value across every hour; battery `power_kw` uses the daily-average flow `(charge − discharge) / 24h`.

**Tesla Fleet API host hardening**: `lib/adapters/providers/tesla.ts` ignores any `base_url` in `connection_config` and instead maps an optional `region` enum (`'na'` / `'eu'` / `'cn'`) to one of three hardcoded Tesla Fleet hosts (`TESLA_FLEET_HOSTS` allowlist). The internal `tFetch` builder also strips any absolute URL down to its path before re-prefixing with the allowlisted host, so the bearer access_token cannot be exfiltrated to an attacker-controlled server through a malicious `connection_config`. `isConfigured()` requires `access_token` plus either `vehicle_id` (for EV devices, which read from `/api/1/vehicles/:vehicle_id/*`) or `site_id` (for energy-site devices that read from `/api/1/energy_sites/:site_id/*`) — EV-only Tesla setups that don't own a Powerwall are therefore considered configured without a `site_id`.

**Home Assistant entity model**: HA exposes a sensor per measurement, never a multi-metric entity. The connection schema therefore offers three optional entity fields per device: `entity_id` (the primary instantaneous-reading sensor — power W/kW for solar/house/grid, SoC percent 0–100 for batteries/EVs), `energy_entity_id` (an optional cumulative kWh meter used for historical energy charts; falls back to `entity_id` when unset), and `power_entity_id` (an optional power sensor used for battery/EV power-shaped data — both LIVE status (`batteryPowerKw`, `evChargeRateKw`) and history (`power_kw` / `charge_kw`)). Because the primary `entity_id` for batteries and EVs is a SoC percent sensor that cannot answer power queries, when `power_entity_id` is unset `getStatus()` leaves `batteryPowerKw` / `evChargeRateKw` undefined and `getHistory()` returns `[]` for power-shaped reads — instead of reinterpreting percent values as kilowatts. When configured, `getStatus()` fetches that sensor (rejecting non-power units to prevent mislabeling) and derives `evPluggedIn = rate > 0` for EVs. The downstream solver then either uses the real power values directly or, for batteries when no power sensor is configured, infers battery flow from SoC-kWh deltas.

**SolarEdge historical energy endpoints**: SolarEdge exposes two distinct energy APIs and choosing the wrong one silently corrupts dashboard analytics. `/site/:id/energy` returns site-wide PRODUCTION kWh per hour — correct for `solar_array` only. `/site/:id/energyDetails` returns per-meter kWh per timestep (PRODUCTION / CONSUMPTION / PURCHASED / FEEDIN / SELFCONSUMPTION) and is required for house (`meters=CONSUMPTION`) and grid (`meters=PURCHASED,FEEDIN`, computing signed kWh = imported − exported to match the live grid sign convention). Returning `[]` for house/grid `energy_kwh` would collapse the flows-history, analytics, backup-runtime, and house-history routes to zero for SolarEdge users, so the adapter dispatches by `device.type` and uses the right endpoint per role. kWh-per-hour samples land in `bucketSumEnergy` upstream (additive within an hour bucket), so no integration step is needed.

**Simulator presence vs liveness**: `SimulatedAdapter.getStatus()` intentionally reports `isLive: false` (so the UI can label simulator output honestly) but populates the requested data fields. Routes that consume status therefore gate on the **presence of a value** (e.g. `houseStatus.houseLoadKw != null`), NOT on `isLive`. Gating on `isLive` would silently drop user-added simulated devices to zero — a regression that undermines the explicit-only simulator policy in the opposite direction (a device the user explicitly added would behave as if it weren't there).

**Power → energy integration contract**: `charge_kw`, `power_kw`, and `grid_kw` histories are **instantaneous-rate** series (kW snapshots), so a raw sum of samples is NOT energy — sub-hourly cadence (Home Assistant 5-min, SolarEdge 15-min, Tesla 5-min) would inflate the figure by the sample count per hour (e.g. a 7 kW charger sampled every 5 minutes for one hour summed reads as ~84 "kWh" instead of 7 kWh). Routes converting power-shaped histories into energy MUST first bucket-average each device's series to one value per ISO hour via `bucketAvgRate` (`lib/server/adapter-flows.ts`), then sum across devices per hour. Once one value per hour, kW × 1h = kWh-per-hour, and summing across hours yields kWh totals. The EV route uses this for `energy_today_kwh`, `month_energy_mwh`, `clean_energy_pct`, and the `history.total_kw` chart; the battery route's `bucketLastByHour` likewise gives one value per hour so its `chargedToday` / `dischargedToday` accumulators are unit-correct without an extra integration step. `energy_kwh` series, by contrast, are additive per interval and are still summed directly within an hour bucket via `bucketSumEnergy`.

**Tesla EV charging history**: Tesla doesn't expose minute-by-minute vehicle telemetry to third parties, but the Fleet API does publish completed charging sessions at `GET /api/1/dx/vehicles/charging/history` (paged, `pageSize=50`). Crucially, this endpoint keys on the **17-character VIN**, NOT the numeric `vehicle_id` that `/api/1/vehicles/:vehicle_id/vehicle_data` (status) uses. The two identifiers are stored as separate `connection_config` fields (`vehicle_id` for status, `vin` for history) so each endpoint receives the identifier it actually expects; EV current status works with just `vehicle_id`, and adding `vin` unlocks the historical charging chart and energy totals. `TeslaAdapter.getEvChargingHistory()` collects sessions that overlap the requested window (cap: 10 pages × 50 = 500 sessions), then converts each into **overlap-weighted per-hour kWh** contributions: for every ISO hour the clipped session covers, it adds `avgKw × overlap_hours` (where `avgKw = energy_added_in_kwh / session_hours`) into a hour-start → kWh accumulator. Critically, this means a 10-minute session spanning 12:55–13:05 contributes ~`avgKw × 5/60` kWh to hour 12:00 AND ~`avgKw × 5/60` kWh to hour 13:00 — together totaling the session's true energy — instead of being miscounted as ~2 hours of full-rate charging (the bug if you emit `avgKw` for every touched hour and let `bucketAvgRate` treat each as a full 1h bucket). Multiple sessions overlapping the same hour are summed in the accumulator before emit, so each hour ends up with exactly one sample and downstream `bucketAvgRate` (count=1) averages to the same value. Combined with the EV route's `bucketAvgRate` integration contract, this gives the dashboard correct values for `energy_today_kwh`, `month_energy_mwh`, `clean_energy_pct`, the `history.total_kw` chart, and `last_charged_label` instead of collapsing them to zero or inflating short sessions. Vehicle SoC history isn't exposed by the charging endpoint, so non-`charge_kw` EV metrics still return `[]`.

**Credential lifecycle**:
1. The Settings UI submits credentials to `/api/configuration/devices`, which encrypts the payload using AES-256-GCM (`lib/crypto/connection-config.ts`) before writing to `devices.connection_config`.
2. On every authenticated request, `loadUserContext()` (in `lib/server/device-context.ts`) decrypts each device's `connection_config` and exposes a `persistConnectionConfig(deviceId, plaintext)` callback scoped to the authenticated user.
3. Server routes pass that callback into `createAdapter(device, { ..., persistConfig })`. The factory binds the `deviceId` and forwards a `CredentialPersister` to OAuth/Cognito adapters (Tesla, Enphase, Emporia).
4. When an OAuth access_token is rejected (HTTP 401), the adapter exchanges the refresh_token, retries the original call once, and persists the rotated `{ access_token, refresh_token, expires_at }` back to `devices.connection_config` (re-encrypted) so subsequent requests reuse the new token.

### Data Generation

`lib/data-generator/` provides deterministic fake data:
- Solar irradiance model uses sun angle + season + weather randomness
- House load model uses time-of-day patterns + seasonal HVAC factors + appliance spikes
- `client-generators.ts` exposes browser-safe versions for React hooks
- `lib/hooks/use-data-generation.ts` provides `useSolarData`, `useHouseLoadData`, `useUserDevices` hooks that fetch device config from Supabase then generate or fetch data through adapters

### Authentication Flow

1. Sign-up/login via Supabase Auth (email + password)
2. Session cookies managed by `@supabase/ssr` middleware
3. Dashboard layout server component verifies user on every render; unauthenticated → redirect to `/auth/login`
4. Client components use `createBrowserClient` for auth actions (logout, password change)
5. Account deletion handled via a POST route handler that uses admin-level Supabase access

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| **Supabase** | PostgreSQL database + Auth + Row Level Security. Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars |
| **Vercel** | Intended deployment target (`VERCEL_URL` env var used for `metadataBase`) |
| **Google Fonts** | Inter + Fraunces loaded via `next/font/google` at build time |
| **Tesla API** (future) | EV and Powerwall integration via `TeslaAdapter` |
| **Enphase API** (future) | Solar microinverter data via `EnphaseAdapter` |
| **SolarEdge API** (future) | Solar inverter data via `SolarEdgeAdapter` |
| **Home Assistant** (future) | Local smart home hub integration via `HomeAssistantAdapter` |
| **Emporia** (future) | Energy monitor integration via `EmporiaAdapter` |
| **Electricity Maps / WattTime** (implied) | Grid carbon intensity data stored in `zone_key` on profile; `generate-fake-grid-data.ts` simulates this feed |

**Required environment variables**:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # for admin operations (account deletion)
CONNECTION_CONFIG_SECRET=          # 64-char hex string for encrypting device credentials
```

**Dev server**: runs on port 5000 (`next dev --turbopack --port 5000`).