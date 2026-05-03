/**
 * Lightweight error reporter.
 *
 * When SENTRY_DSN is set the reporter sends a minimal Sentry-compatible
 * envelope to that DSN so uncaught server errors appear in your Sentry
 * project. When the variable is absent (local dev) the reporter is a no-op
 * so the dev experience stays quiet.
 *
 * Sensitive fields are scrubbed via the same deny-list used by the logger.
 *
 * Usage:
 *   import { reportError } from '@/lib/reporter';
 *   try { ... } catch (err) {
 *     reportError(err, { route: '/api/energy/snapshot', userId });
 *   }
 *
 * Client-side:
 *   Call initClientReporter() once in a top-level client component or
 *   in _app / root layout. It registers a window.onerror + unhandledrejection
 *   listener that pipes errors through reportError().
 */

const SENSITIVE_KEYS = /token|secret|password|api_key|credential|__encrypted/i;

function scrubTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[redacted]' : v;
  }
  return out;
}

export interface ReportContext {
  route?: string;
  userId?: string;
  requestId?: string;
  provider?: string;
  tags?: Record<string, string>;
}

function getDsn(): string | null {
  return process.env.SENTRY_DSN ?? null;
}

function parseDsn(dsn: string): { storeUrl: string; authHeader: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const projectId = url.pathname.replace(/^\//, '');
    const storeUrl = `https://${host}/api/${projectId}/store/`;
    const authHeader = `Sentry sentry_version=7, sentry_key=${publicKey}`;
    return { storeUrl, authHeader };
  } catch {
    return null;
  }
}

export function reportError(err: unknown, ctx: ReportContext = {}): void {
  // In the browser, use the public DSN env var exposed to the client bundle.
  const dsn =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_SENTRY_DSN ?? null)
      : getDsn();
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  const tags = scrubTags({
    ...(ctx.route ? { route: ctx.route } : {}),
    ...(ctx.provider ? { provider: ctx.provider } : {}),
    ...(ctx.requestId ? { request_id: ctx.requestId } : {}),
    ...(ctx.tags ?? {}),
  });

  const user = ctx.userId ? { id: ctx.userId } : undefined;

  const payload = {
    timestamp: new Date().toISOString(),
    platform: typeof window !== 'undefined' ? 'javascript' : 'node',
    level: 'error',
    message,
    tags,
    ...(user ? { user } : {}),
    exception: {
      values: [
        {
          type: err instanceof Error ? err.constructor.name : 'Error',
          value: message,
          ...(stack ? { stacktrace: { frames: [{ raw_function: stack }] } } : {}),
        },
      ],
    },
  };

  fetch(parsed.storeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': parsed.authHeader,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/**
 * Call once in your root client component (e.g. app/layout.tsx with
 * "use client") to wire up browser-level error reporting.
 * This is a no-op when NEXT_PUBLIC_SENTRY_DSN is not set.
 */
export function initClientReporter(): void {
  if (typeof window === 'undefined') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const send = (msg: string, stack?: string) => {
    const parsed = parseDsn(dsn);
    if (!parsed) return;
    fetch(parsed.storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': parsed.authHeader,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        platform: 'javascript',
        level: 'error',
        message: msg,
        exception: { values: [{ type: 'Error', value: msg, ...(stack ? { stacktrace: { frames: [{ raw_function: stack }] } } : {}) }] },
      }),
    }).catch(() => {});
  };

  window.addEventListener('error', (ev) => {
    send(ev.message, ev.error?.stack);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const msg = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
    send(msg, ev.reason instanceof Error ? ev.reason.stack : undefined);
  });
}
