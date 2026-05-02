import { NextRequest, NextResponse } from 'next/server';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const store = new Map<string, Bucket>();

const READ_MAX = parseInt(process.env.RATE_LIMIT_READ_MAX ?? '60', 10);
const READ_WINDOW_MS = parseInt(process.env.RATE_LIMIT_READ_WINDOW_MS ?? '60000', 10);

const WRITE_MAX = parseInt(process.env.RATE_LIMIT_WRITE_MAX ?? '10', 10);
const WRITE_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WRITE_WINDOW_MS ?? '60000', 10);

function consume(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket) {
    bucket = { tokens: max, lastRefill: now };
    store.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  if (elapsed >= windowMs) {
    bucket.tokens = max;
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSec: 0 };
  }

  const retryAfterSec = Math.ceil((windowMs - elapsed) / 1000);
  return { allowed: false, retryAfterSec };
}

function buildKey(userId: string | null, ip: string, prefix: string): string {
  return `${prefix}:${userId ?? 'anon'}:${ip}`;
}

export function checkReadRateLimit(req: NextRequest, userId: string | null): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  const key = buildKey(userId, ip, 'read');
  const { allowed, retryAfterSec } = consume(key, READ_MAX, READ_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }
  return null;
}

export function checkWriteRateLimit(req: NextRequest, userId: string | null): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown';
  const key = buildKey(userId, ip, 'write');
  const { allowed, retryAfterSec } = consume(key, WRITE_MAX, WRITE_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }
  return null;
}
