/**
 * Structured JSON logger for server-side API routes and adapters.
 *
 * Each log line is a single JSON object written to stdout. Fields:
 *   level       — 'info' | 'warn' | 'error' | 'debug'
 *   ts          — ISO 8601 timestamp
 *   msg         — human-readable message
 *   request_id  — per-request UUID (set via middleware x-request-id header)
 *   user_id     — authenticated user ID when available
 *   route       — Next.js route path (e.g. '/api/energy/snapshot')
 *   provider    — provider type when the log originates from an adapter
 *   [rest]      — arbitrary extra fields; secrets are never included
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger({ route: '/api/energy/snapshot', userId: user.id });
 *   log.info('Fetching snapshot', { device_count: 3 });
 *   log.error('Adapter failed', { provider: 'tesla', error: err.message });
 *
 * Sensitive-field deny-list: the logger strips any key whose name contains
 * 'token', 'secret', 'password', 'key', 'credential', or '__encrypted'
 * from the extra-fields object before serialising so that accidental
 * log.info('config', { access_token: '…' }) calls never surface secrets.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = /token|secret|password|api_key|credential|__encrypted/i;

function scrub(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = '[redacted]';
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = scrub(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface LogContext {
  request_id?: string;
  user_id?: string;
  route?: string;
  provider?: string;
}

function write(level: LogLevel, ctx: LogContext, msg: string, extra?: Record<string, unknown>) {
  const line: Record<string, unknown> = {
    level,
    ts: new Date().toISOString(),
    msg,
    ...ctx,
    ...(extra ? scrub(extra) : {}),
  };
  const out = JSON.stringify(line);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(out + '\n');
  } else {
    process.stdout.write(out + '\n');
  }
}

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void;
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
  child(extra: Partial<LogContext>): Logger;
}

export function createLogger(ctx: LogContext = {}): Logger {
  return {
    debug: (msg, extra) => write('debug', ctx, msg, extra),
    info:  (msg, extra) => write('info',  ctx, msg, extra),
    warn:  (msg, extra) => write('warn',  ctx, msg, extra),
    error: (msg, extra) => write('error', ctx, msg, extra),
    child: (extra) => createLogger({ ...ctx, ...extra }),
  };
}

export const rootLogger = createLogger({});
