# Sustainable Smart Home

## Overview

The Sustainable Smart Home project is a Next.js 15 web application designed for monitoring and managing residential energy systems. Its core purpose is to provide users with a comprehensive dashboard to track various energy components, including solar panel generation, battery storage, EV charging, and grid interactions. The platform supports both live data integration from real hardware providers (e.g., Tesla, Enphase, SolarEdge, Home Assistant, Emporia Vue) and simulated data for user-configured virtual devices. The project aims to offer a user-friendly interface for energy management, with a focus on sustainability and efficiency. Key capabilities include device configuration, location-based energy insights, notification management, and detailed analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

- **Framework**: Next.js 15 (App Router) with React 19 and TypeScript 5.
- **Styling**: Tailwind CSS 3 for utility-first styling, using CSS custom properties for theming, and `next-themes` for dark/light mode.
- **Component Library**: shadcn/ui (new-york style) built on Radix UI primitives.
- **Icons**: Lucide React.
- **Charts**: Recharts integrated with shadcn's `ChartContainer`.
- **Animations**: Framer Motion for page transitions and a route progress bar.
- **Fonts**: Inter (sans-serif) and Fraunces (serif for display headings) via `next/font/google`.
- **Design Language**: "Organic & earthy" color palette with semantic tokens, enforcing no hardcoded color classes via a custom linting script.
- **Route Structure**:
    - `/`: Public landing page.
    - `/auth/*`: Authentication flows (login, sign-up, password reset).
    - `/app/*`: Protected dashboard with sidebar navigation.
    - `/app/settings`: Device configuration, location, and account settings.
- **Layout Pattern**: Dashboard layout (`app/app/layout.tsx`) is a server component handling authentication and rendering the navigation shell.

### Backend / API

- **Server-side Logic**: Implemented using Next.js Route Handlers and Server Components.
- **Database Interaction**: Direct Supabase client access from server components and route handlers via `@supabase/ssr`.
- **Middleware**: `middleware.ts` refreshes Supabase auth sessions on most requests.

### Data Layer

- **Database**: Supabase (PostgreSQL) is the primary data store.
- **Authentication**: Supabase Auth handles user authentication (email/password).
- **ORM**: Direct Supabase JS client queries are used.
- **Key Tables**: `profiles` (user/location), `devices` (energy device registry), `solar_config`, `battery_config`, `ev_config`, `power_generation` (time-series), `energy_flows` (time-series).
- **Credential Security**: Device connection configurations (API keys, tokens) are encrypted at rest using AES-256-GCM.

### Device Adapter Pattern

- **Abstraction**: `lib/adapters/` provides a `DeviceAdapter` interface for `getStatus()`, `getHistory()`, and `sendCommand()`.
- **Adapters**: Includes `SimulatedAdapter` for fake data and live adapters for Tesla, Enphase, SolarEdge, Home Assistant, and Emporia.
- **Behavior**: Live adapters return `isLive:false` and error reasons on failure; they do not fall back to simulation. The `SimulatedAdapter` is only used for explicitly configured simulated devices.
- **Security**: Home Assistant adapter includes SSRF guards. Tesla adapter hardens API host resolution to prevent token exfiltration.
- **Data Handling**: Specific logic for Home Assistant cumulative meters (delta calculation), Enphase daily aggregate expansion, SolarEdge historical energy endpoint selection, and Tesla EV charging history (overlap-weighted hourly kWh).
- **Snapshot and Flow Solvers**: `solveFlowsHistoryFromAdapters` and `solveCurrentFlowFromAdapters` aggregate data from various adapters to build time-series and real-time flow data, respectively.
- **Role-based Empty States**: UI gracefully handles missing device configurations by indicating empty states and guiding users to settings rather than fabricating data.
- **Credential Lifecycle**: OAuth credentials are securely exchanged and refreshed, with tokens encrypted and persisted to the database.

### Data Generation

- `lib/data-generator/` creates deterministic fake data for `SimulatedAdapter` and database population utilities. This includes solar irradiance and house load models.

### Authentication Flow

- **Mechanism**: Supabase Auth for sign-up/login.
- **Session Management**: `@supabase/ssr` middleware.
- **Authorization**: Dashboard layout enforces authentication, redirecting unauthenticated users.
- **Account Management**: Client-side auth actions and server-side account deletion.

### Real-Device Connectivity Foundation

- **OAuth Handshake Routes**: Generic routes (`/api/auth/oauth/[provider]/start` and `/api/auth/oauth/[provider]/callback`) manage provider-agnostic OAuth flows, storing challenges/states as HttpOnly cookies and persisting encrypted tokens.
- **Background Sync Cron**: `app/api/cron/sync-devices/route.ts` periodically fetches `getStatus()` for live devices, ingests data, and updates `device_sync_state`.
- **`device_sync_state` Table**: Tracks device sync status, errors, and rate limits.
- **Health API**: `app/api/configuration/devices/health/route.ts` provides a summary of device connection health.
- **Settings UI**: Displays connection health, re-connection options, and OAuth "Connect" buttons based on environment variable availability.
- **Dashboard Banner**: Notifies users of disconnected devices.

### Observability & Testing

- **Structured Logger**: `lib/logger.ts` provides a `Logger` for JSON-formatted logs with redaction of sensitive data.
- **Request ID**: `middleware.ts` generates unique `x-request-id` headers for request correlation.
- **Error Reporter**: `lib/reporter.ts` integrates with Sentry for error reporting, scrubbing sensitive tags.
- **Health Endpoint**: `app/api/health/route.ts` provides a public endpoint for system health, including database and provider status.
- **Testing**: Includes unit tests (using Node.js's built-in `tsx --test`) and end-to-end tests (Playwright) with comprehensive fixtures.

## External Dependencies

- **Supabase**: PostgreSQL database, Authentication, Row Level Security.
- **Vercel**: Intended deployment platform.
- **Google Fonts**: Inter and Fraunces fonts.
- **Tesla Fleet API**: For EV and Powerwall integration.
- **Enphase Enlighten v4**: For solar microinverter data.
- **SolarEdge Monitoring API**: For solar inverter data.
- **Home Assistant REST**: For local smart home hub integration.
- **Emporia Vue**: For energy monitor integration.
- **Electricity Maps / WattTime (implied)**: For grid carbon intensity data (`zone_key`).
- **Environment Variables**: Critical configuration stored in environment variables, including Supabase credentials, encryption keys, API keys for external services, and OAuth client IDs/secrets.
## Known Production Issues

- **`audit_logs` table missing in production Supabase** (verified 2026-05-03 via REST 404). Migrations `002_add_audit_logs.sql` and `003_audit_logs_service_role_only.sql` need to be re-applied via the Supabase Dashboard SQL Editor. While missing, `/api/audit-log` returns 500 on every settings page load and all server-side `recordAuditEvent()` calls are silently swallowed by the try/catch in `lib/audit/log.ts`.

## Client-Side Fetch Conventions

All client-side calls to JSON API routes must go through `lib/client/fetch-json.ts`'s `fetchJson()` helper, not raw `fetch().json()`. The helper checks `Content-Type`, reads the body once, and throws a `FetchJsonError` carrying status + body excerpt, so non-JSON responses (HTML error pages, proxy timeouts, missing-env 503s) never surface as the opaque "Unexpected token '<', '<!DOCTYPE'..." parse error in the Next.js dev overlay.
