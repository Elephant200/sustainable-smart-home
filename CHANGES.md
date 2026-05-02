# Cleanup Summary — May 2, 2026

This document records what was cleaned up in the post-merge repo-cleanup pass.

## Lint: 10 warnings → 0 warnings

All pre-existing `react-hooks/set-state-in-effect` and `react-hooks/static-components`
warnings were resolved. No rules were disabled — the violations were fixed at the call site.

| File | Fix applied |
|---|---|
| `app/app/alerts/page.tsx` | Extracted `renderTypeIcon` / `renderCategoryIcon` as module-level render helpers returning JSX (not component-type variables), eliminating the static-components warning. |
| `lib/hooks/use-energy-data.ts` | Restructured `useFetch` to derive `loading` from a URL+tick mismatch check rather than calling `setState` synchronously in the effect body. All state updates now occur exclusively in async `.then()` / `.catch()` callbacks. |
| `components/layout/theme-switcher.tsx` | Replaced `useState(false) + useEffect(() => setMounted(true))` with React's `useSyncExternalStore` — the canonical pattern for client-only rendering without a hydration effect. |
| `components/settings/theme-settings-card.tsx` | Same `useSyncExternalStore` migration as `theme-switcher.tsx`. |
| `components/layout/error-content.tsx` | Removed `useState` entirely; `errorDetails` is now derived inline from the current `error` prop so it always reflects the latest error on re-renders. Kept `useEffect` only for the `console.error` side-effect. |
| `components/layout/not-found-content.tsx` | Derived the full URL via `useSyncExternalStore` (server snapshot: pathname only; client snapshot: origin + pathname), eliminating the state/effect pair entirely. |
| `components/settings/configuration-alert.tsx` | Derived `isOpen` directly from `useSearchParams()` and used `router.replace` to close, removing the `useState` + `useEffect` pair. |
| `components/settings/device-configuration.tsx` | Inlined the device fetch into the `useEffect` with a promise chain; `setDevices` is now only ever called inside `.then()` (async). |
| `components/settings/notification-settings-card.tsx` | Replaced `useEffect` + `Promise.resolve().then()` with `useSyncExternalStore`. A module-level pub-sub (`prefsListeners`) notifies same-tab writes; a `storage` event listener covers cross-tab changes. `hydrated` is also derived via `useSyncExternalStore` (no effects at all). |
| `components/settings/add-device-dialog.tsx` | Replaced `useEffect` + `Promise.resolve().then()` with React's "setState during render" derived-state pattern. A `sessionId` string is computed from `isOpen`, `deviceType`, `editingDevice.id`, and `existingDevices.length`. On open/target-change, form state is initialised synchronously in the render pass. On close (`sessionId === ''`), `lastSessionId` is cleared so the next open always re-initialises even when device type and count are unchanged. |

## Dead code removed

- **`lib/hooks/use-data-generation.ts`** — exported `useUserDevices`, `useSolarData`, and `useHouseLoadData` hooks that were no longer imported anywhere in the application. The live data pipeline (`lib/hooks/use-energy-data.ts` + API routes) supersedes this file entirely.
- **`lib/data-generator/solar-data.ts` — bare top-level invocation** — the file ended with `generateWeekOfSolarData('df7510ba-a2d5-4ead-a35a-9f25bf2132f8');`, a leftover debug call that executed at module-import time. During `next build`, static-page generation imports this module, which triggered `await createClient()` (Supabase cookies) outside a request scope — producing repeated runtime errors in the build output. The line was removed; the function itself is intact and callable from `lib/data-generator/populate-database.ts`.

## Docs updated

- **`replit.md`**
  - Updated the *Data Generation* section: removed the stale `use-data-generation.ts` reference; clarified the `data-generator/` module's role as the `SimulatedAdapter` back-end and `populate-database` seed utility.
  - Removed `(future)` labels from the External Dependencies table — Tesla, Enphase, SolarEdge, Home Assistant, and Emporia adapters are all implemented and live.
  - Expanded the environment variable section to cover all 10 vars the codebase actually uses: Supabase credentials, `CONNECTION_CONFIG_SECRET`, `ELECTRICITYMAPS_API_KEY`, `GOOGLE_MAPS_API_KEY`, `TESLA_CLIENT_ID`, `ENPHASE_CLIENT_ID`/`SECRET`, `HOME_ASSISTANT_ALLOWED_HOSTS`, `VERCEL_URL`.
- **`README.md`**
  - Replaced the "Demo Notice" (no hardware integration) with an accurate live-provider notice.
  - Corrected the project structure tree to match the actual directory layout (added `energy/` sub-routes, `adapters/`, `crypto/`, `simulation/`, `server/`, `scripts/`; removed non-existent directories).
  - Updated the environment variable setup to document all required env vars.
  - Fixed the database-seeding step to use the actual `/api/populate-database?action=populate` URL (removed `npm run populate-db` which does not exist in `package.json`).
  - Replaced the stub API docs with the complete list of `/api/energy/*` endpoints.
  - Corrected tech-stack section (removed "real-time subscriptions" / "Edge Functions", added AES-256-GCM encryption).

## Verification

- `npm run lint` — **0 errors, 0 warnings**
- `npx tsc --noEmit` — **no type errors**
- `npm run build` — **successful**
