import { test, expect } from '@playwright/test';

/**
 * E2E tests for the /api/health endpoint.
 *
 * These tests run against the live application server and verify the
 * endpoint shape, status code, and cache headers. They do NOT require
 * authentication.
 */
test.describe('GET /api/health', () => {
  test('returns 200 or 503 with correct JSON shape', async ({ request }) => {
    const response = await request.get('/api/health');

    // Must be either 200 (ok) or 503 (degraded — DB unreachable in CI)
    expect([200, 503]).toContain(response.status());

    const body = await response.json();

    expect(body).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(body.status);

    expect(body).toHaveProperty('version');
    expect(typeof body.version).toBe('string');

    expect(body).toHaveProperty('db');
    expect(typeof body.db.ok).toBe('boolean');
    expect(typeof body.db.latency_ms).toBe('number');

    expect(body).toHaveProperty('providers');
    expect(typeof body.providers).toBe('object');
  });

  test('response has Cache-Control: no-store header', async ({ request }) => {
    const response = await request.get('/api/health');
    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toContain('no-store');
  });

  test('returns JSON content-type', async ({ request }) => {
    const response = await request.get('/api/health');
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('status field matches HTTP status code', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();
    if (response.status() === 200) {
      expect(body.status).toBe('ok');
    } else {
      expect(body.status).toBe('degraded');
    }
  });
});
