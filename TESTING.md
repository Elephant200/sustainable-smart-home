# Testing Guide

This document describes the test infrastructure, how to run tests, and how to
write new tests for the Sustainable Smart Home platform.

---

## Test Types

### Unit Tests

Unit tests use Node.js's built-in `node:test` runner (no Jest or Vitest).
They live next to the source files they exercise, named `*.test.ts`.

**What is tested:**

| File | Covers |
|---|---|
| `lib/logger.test.ts` | Structured JSON logger, sensitive-field scrubbing |
| `lib/api/rate-limit.test.ts` | Token-bucket limiter, 429 response shape |
| `lib/api/validate.test.ts` | Zod body / query / params validation helpers |
| `lib/audit/log.test.ts` | Audit-log helper, error-tolerance guarantees |
| `lib/adapters/providers/tesla.test.ts` | Tesla adapter — response mapping, isConfigured() |
| `lib/adapters/providers/enphase.test.ts` | Enphase adapter — response mapping, isConfigured() |
| `lib/adapters/providers/solaredge.test.ts` | SolarEdge adapter — unit conversion (W→kW), device types |
| `lib/adapters/providers/home-assistant.test.ts` | HA adapter — state parsing, SSRF guard |
| `lib/adapters/providers/emporia.test.ts` | Emporia adapter — schema, isConfigured() |
| `lib/crypto/connection-config.test.ts` | AES-GCM encryption round-trip |

**Running unit tests:**

```bash
npm test
```

The test glob is `lib/**/*.test.ts`. Tests are run with `tsx --test`.

**Writing new unit tests:**

```ts
import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

describe('myModule', () => {
  test('does the right thing', () => {
    assert.equal(1 + 1, 2);
  });
});
```

Keep tests hermetic — stub network calls by replacing `globalThis.fetch`:

```ts
beforeEach(() => { originalFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = originalFetch; });

globalThis.fetch = async () =>
  new Response(JSON.stringify(fixtureData), { status: 200 }) as Response;
```

---

### Provider Fixtures

Real-shape JSON responses for each provider live in
`lib/adapters/providers/fixtures/`. Each file mirrors the actual API response
shape documented in the provider's header comment. Use these fixtures in
adapter tests instead of hard-coded inline objects.

| Fixture | Provider / Endpoint |
|---|---|
| `tesla-live-status.json` | Tesla `/energy_sites/:id/live_status` |
| `tesla-vehicle-data.json` | Tesla `/vehicles/:id/vehicle_data` |
| `tesla-power-history.json` | Tesla `/energy_sites/:id/history` |
| `enphase-summary.json` | Enphase `/api/v4/systems/:id/summary` |
| `enphase-battery-telemetry.json` | Enphase `/telemetry/battery` |
| `enphase-production-telemetry.json` | Enphase `/telemetry/production_micro` |
| `solaredge-current-power-flow.json` | SolarEdge `/site/:id/currentPowerFlow` |
| `solaredge-energy.json` | SolarEdge `/site/:id/energy` |
| `emporia-device-usages.json` | Emporia `/AppAPI?apiMethod=getDeviceListUsages` |
| `home-assistant-solar-state.json` | HA `/api/states/sensor.solar_power` |
| `home-assistant-battery-state.json` | HA `/api/states/sensor.battery_soc` |
| `home-assistant-history.json` | HA `/api/history/period/:start` |

---

### End-to-End (E2E) Tests

E2E tests use [Playwright](https://playwright.dev/) and live in the `e2e/`
directory. They run against the real Next.js dev server.

**Setup (first time):**

```bash
# Install browser binaries — required once per environment
npx playwright install --with-deps chromium firefox
```

**Running e2e tests:**

```bash
# Against local dev server (starts automatically via webServer config)
npm run test:e2e

# Against a deployed URL
BASE_URL=https://your-app.replit.app npm run test:e2e

# Headed mode (shows browser)
npm run test:e2e -- --headed

# Interactive UI mode
npm run test:e2e -- --ui
```

**E2E test files:**

| File | What it tests |
|---|---|
| `e2e/health.spec.ts` | `/api/health` endpoint shape, status, headers, timing |
| `e2e/public.spec.ts` | Landing page, auth routes, CTA visibility, protected-route redirect |
| `e2e/login.spec.ts` | Login and sign-up page structure, client-side validation, navigation links |
| `e2e/rate-limit.spec.ts` | 401 vs 429 distinction; no Retry-After on health endpoint |
| `e2e/user-journey.spec.ts` | Full navigation journeys, route guards, API error surface, observability headers |

---

## Running All Tests

```bash
# Unit tests
npm test

# E2E tests (requires browser install + running server)
npm run test:e2e
```

---

## CI Notes

- Unit tests run without any external services (DB, OAuth, provider APIs).
- E2E tests run against a locally started Next.js server (or `BASE_URL`).
- The health endpoint returns 503 in CI (no DB) — e2e tests accept both 200 and 503.
- Playwright retries failed tests twice in CI (`retries: 2` in `playwright.config.ts`).

---

## Manual Verification Checklist

These flows require a live Supabase session and should be checked after each
significant merge. Check each item on the staging or production environment.

### Authentication
- [ ] Sign up with a new email address — confirmation email sent, landing on onboarding
- [ ] Log in with correct credentials — redirected to `/app` dashboard
- [ ] Log in with wrong password — error message shown, no redirect
- [ ] Forgot password flow — reset email received, password updated successfully
- [ ] Accessing `/app` while logged out redirects to `/auth/login`

### Device Management
- [ ] Add a **simulated solar array** (10 panels, 0.4 kW/panel) — appears in device list
- [ ] Dashboard shows solar generation card with non-zero kW value
- [ ] Add a **simulated battery** (10 kWh, 5 kW max) — battery state-of-charge shown
- [ ] Add a **simulated EV** — EV charge session card appears
- [ ] Edit a device name — updated name shows in the device list immediately
- [ ] Delete (deactivate) a device — removed from list; dashboard no longer shows its card
- [ ] Disconnected device shows degraded/error state (≥ 3 consecutive failures)

### Energy Dashboard
- [ ] Energy flow diagram shows correct arrows (solar → house → grid)
- [ ] Historical chart renders for last 7 days (non-zero bars for simulated devices)
- [ ] Analytics page loads without errors; savings/CO₂ numbers present

### Settings & OAuth
- [ ] Settings page lists all connected devices
- [ ] Adding a Tesla device with OAuth shows the provider connection button
- [ ] OAuth error callback (`?oauth_error=...`) shows an error message, not a crash

### Observability
- [ ] `GET /api/health` returns `{ status: "ok", db: { ok: true } }` when DB is up
- [ ] `GET /api/health` returns HTTP 503 when DB env vars are absent
- [ ] Server logs (stdout) contain JSON lines with `level`, `ts`, `msg`, `route` fields
- [ ] Tokens / secrets never appear in log output (scrubbing active)
- [ ] All log lines from a single request share the same `x-request-id` UUID

### Rate Limiting
- [ ] Sending > 60 GET requests/minute to an authenticated route returns HTTP 429
- [ ] 429 response body is `{ "error": "Too many requests" }`
- [ ] `Retry-After` header is present on the 429 response
- [ ] Rate limit resets after 60 seconds

### Error Boundary
- [ ] Navigating to a non-existent `/app/*` route shows the error page (not a blank screen)
- [ ] The error page has a "Try again" / reset button that reloads the current page
