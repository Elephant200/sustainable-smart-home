import { test, describe, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';

// Isolate the rate limiter's in-memory store on each test run
// by re-importing a fresh module. Node's test runner shares module
// cache across tests in the same file, so we manipulate the
// exported functions via a controlled environment instead.

import { checkReadRateLimit, checkWriteRateLimit } from './rate-limit';

function makeReq(ip: string): Parameters<typeof checkReadRateLimit>[0] {
  return {
    headers: {
      get: (name: string) => {
        if (name === 'x-forwarded-for') return ip;
        if (name === 'x-real-ip') return null;
        return null;
      },
    },
  } as unknown as Parameters<typeof checkReadRateLimit>[0];
}

describe('rate-limit', () => {
  const userId = 'user-test-' + Math.random().toString(36).slice(2);
  const ip = `10.0.0.${Math.floor(Math.random() * 254) + 1}`;

  test('returns null (allowed) for first read request', () => {
    const result = checkReadRateLimit(makeReq(ip), userId);
    assert.equal(result, null);
  });

  test('returns null (allowed) for first write request', () => {
    const result = checkWriteRateLimit(makeReq(ip), userId);
    assert.equal(result, null);
  });

  test('read rate limiter allows many requests within window (default 60)', () => {
    const uid = 'read-test-' + Math.random().toString(36).slice(2);
    const testIp = `192.168.100.${Math.floor(Math.random() * 100) + 1}`;
    const req = makeReq(testIp);
    let blocked = false;
    for (let i = 0; i < 60; i++) {
      const res = checkReadRateLimit(req, uid);
      if (res !== null) { blocked = true; break; }
    }
    assert.equal(blocked, false, 'should allow 60 reads within the default window');
  });

  test('read rate limiter blocks after exhausting tokens', () => {
    const uid = 'exhausted-read-' + Math.random().toString(36).slice(2);
    const testIp = `192.168.200.${Math.floor(Math.random() * 100) + 1}`;
    const req = makeReq(testIp);
    const READ_MAX = parseInt(process.env.RATE_LIMIT_READ_MAX ?? '60', 10);
    for (let i = 0; i < READ_MAX; i++) {
      checkReadRateLimit(req, uid);
    }
    const blocked = checkReadRateLimit(req, uid);
    assert.ok(blocked !== null, 'should block after tokens exhausted');
    const body = blocked as { status: number };
    assert.equal(typeof body, 'object');
  });

  test('write rate limiter blocks after exhausting tokens', () => {
    const uid = 'exhausted-write-' + Math.random().toString(36).slice(2);
    const testIp = `172.16.0.${Math.floor(Math.random() * 100) + 1}`;
    const req = makeReq(testIp);
    const WRITE_MAX = parseInt(process.env.RATE_LIMIT_WRITE_MAX ?? '10', 10);
    for (let i = 0; i < WRITE_MAX; i++) {
      checkWriteRateLimit(req, uid);
    }
    const blocked = checkWriteRateLimit(req, uid);
    assert.ok(blocked !== null, 'should block after write tokens exhausted');
  });

  test('blocked response has status 429', async () => {
    const uid = 'blocked-resp-' + Math.random().toString(36).slice(2);
    const testIp = `10.1.2.${Math.floor(Math.random() * 100) + 1}`;
    const req = makeReq(testIp);
    const WRITE_MAX = parseInt(process.env.RATE_LIMIT_WRITE_MAX ?? '10', 10);
    for (let i = 0; i < WRITE_MAX; i++) {
      checkWriteRateLimit(req, uid);
    }
    const blocked = checkWriteRateLimit(req, uid) as unknown as Response;
    assert.ok(blocked !== null);
    assert.equal(blocked.status, 429);
  });

  test('different users/IPs have separate rate limit buckets', () => {
    const uid1 = 'user-a-' + Math.random().toString(36).slice(2);
    const uid2 = 'user-b-' + Math.random().toString(36).slice(2);
    const ip1 = '203.0.113.1';
    const ip2 = '203.0.113.2';
    const WRITE_MAX = parseInt(process.env.RATE_LIMIT_WRITE_MAX ?? '10', 10);
    for (let i = 0; i < WRITE_MAX; i++) {
      checkWriteRateLimit(makeReq(ip1), uid1);
    }
    const result = checkWriteRateLimit(makeReq(ip2), uid2);
    assert.equal(result, null, 'user2 should still be allowed');
  });
});
