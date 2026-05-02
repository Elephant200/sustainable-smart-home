# Sustainable Smart Home — replit.md

## Overview

Sustainable Smart Home is a Next.js 15 web application for monitoring and managing residential energy systems. It provides a dashboard for tracking solar panel generation, battery storage, EV charging, and grid interaction. The platform currently uses **simulated/generated data** because no physical hardware is connected — real device adapters exist in the codebase (Tesla, Enphase, SolarEdge, Emporia, Home Assistant) but are scaffolded for future integration.

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
- `DeviceAdapter` interface: `getStatus()`, `getHistory()`, `sendCommand()`, `getConnectionSchema()`
- `SimulatedAdapter` — default; generates realistic fake data client-side
- Real adapters (stubbed): `TeslaAdapter`, `EnphaseAdapter`, `HomeAssistantAdapter`, `SolarEdgeAdapter`, `EmporiaAdapter`
- `createAdapter(device)` factory selects the right adapter based on `device.provider_type`

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