# Observability Guide

This document describes how to monitor, log, and report errors in the
Sustainable Smart Home platform.

---

## Structured Logging

All server-side logging goes through `lib/logger.ts` which emits
newline-delimited JSON to stdout (info/debug) and stderr (warn/error).
Each line is a single JSON object with the following standard fields:

| Field | Type | Description |
|---|---|---|
| `level` | string | `'debug'` \| `'info'` \| `'warn'` \| `'error'` |
| `ts` | string | ISO 8601 UTC timestamp |
| `msg` | string | Human-readable message |
| `request_id` | string | UUID generated per HTTP request by middleware |
| `user_id` | string | Authenticated user ID (when available) |
| `route` | string | Next.js route path, e.g. `'/api/energy/snapshot'` |
| `provider` | string | Provider type when logging from an adapter |

**Using the logger in a route handler:**

```ts
import { createLogger } from '@/lib/logger';
import { headers } from 'next/headers';

export async function GET(req: NextRequest) {
  const hdrs = await headers();
  const log = createLogger({
    route: '/api/my-route',
    request_id: hdrs.get('x-request-id') ?? undefined,
    user_id: user?.id,
  });

  log.info('Handling request', { param: value });

  try {
    const result = await doWork();
    log.info('Success', { count: result.length });
    return NextResponse.json(result);
  } catch (err) {
    log.error('Unexpected error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Child loggers** carry parent context into sub-calls:

```ts
const adapterLog = log.child({ provider: 'tesla' });
adapterLog.warn('Token refresh failed', { status: 401 });
```

**Sensitive-field scrubbing:** The logger automatically redacts any extra
field whose key matches `token`, `secret`, `password`, `api_key`,
`credential`, or `__encrypted`. Nested objects are scrubbed recursively.

---

## Request IDs

Middleware (`middleware.ts`) generates a UUID v4 `x-request-id` header for
every request. The same ID is echoed back in the `X-Request-Id` response
header so clients can correlate requests with server logs.

To read the request ID in a route handler:

```ts
import { headers } from 'next/headers';

const hdrs = await headers();
const requestId = hdrs.get('x-request-id');
```

---

## Error Reporting

`lib/reporter.ts` provides a lightweight Sentry-compatible error reporter.
It sends error events to `SENTRY_DSN` when the environment variable is set,
and is a no-op otherwise (safe to call in development with no configuration).

**Server-side:**

```ts
import { reportError } from '@/lib/reporter';

try {
  await riskyOperation();
} catch (err) {
  reportError(err, {
    route: '/api/my-route',
    userId: user.id,
    requestId: hdrs.get('x-request-id') ?? undefined,
  });
}
```

**Client-side (one-time setup in root layout):**

```tsx
'use client';
import { useEffect } from 'react';
import { initClientReporter } from '@/lib/reporter';

export function ClientReporterInit() {
  useEffect(() => { initClientReporter(); }, []);
  return null;
}
```

**Environment variables:**

| Variable | Where set | Description |
|---|---|---|
| `SENTRY_DSN` | Server env | Enables server-side error reporting |
| `NEXT_PUBLIC_SENTRY_DSN` | Public env | Enables client-side error reporting |

Both variables default to no-op if absent.

---

## Health Endpoint

`GET /api/health` — public, no auth required.

Returns a JSON snapshot of system health:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "db": { "ok": true, "latency_ms": 12 },
  "providers": {
    "tesla": { "total": 2, "disconnected": 0 },
    "enphase": { "total": 1, "disconnected": 0 }
  }
}
```

| Field | Description |
|---|---|
| `status` | `'ok'` when DB is reachable, `'degraded'` otherwise |
| `version` | `NEXT_PUBLIC_APP_VERSION` env var, falling back to `npm_package_version` |
| `db.ok` | Whether a test query to Supabase succeeded |
| `db.latency_ms` | Round-trip time in milliseconds |
| `providers` | Per-provider device counts; only present providers are included |
| `providers[x].disconnected` | Devices with ≥ 3 consecutive sync failures |

HTTP status codes:
- `200` — healthy
- `503` — database unreachable

The endpoint sets `Cache-Control: no-store` so monitors always get a fresh
reading.

**Uptime monitor configuration example (UptimeRobot / Better Uptime):**

- URL: `https://your-app.replit.app/api/health`
- Method: GET
- Expected status: 200
- Keyword check: `"status":"ok"`
- Interval: 5 minutes

---

## Log Aggregation

In Replit deployments, stdout/stderr are captured in the deployment log
viewer. For self-hosted or CI environments, pipe the process output to a
log aggregation service:

```bash
# Example: ship to Datadog using its agent
npm start 2>&1 | datadog-agent stream-logs
```

Since each line is valid JSON, tools like `jq` can filter logs locally:

```bash
# Errors from Tesla adapter only
npm start 2>&1 | grep '"level":"error"' | jq 'select(.provider == "tesla")'

# All logs for a specific request
npm start 2>&1 | jq 'select(.request_id == "abc123")'
```
