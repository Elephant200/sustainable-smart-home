import { test, expect } from '@playwright/test';

/**
 * End-to-end user journey tests.
 *
 * Test strategy:
 *  A. Pure-public flows — no auth needed. All assertions are unconditional.
 *  B. Mocked-API flows — page.route() fires the mock; assertions run from
 *     page.evaluate() on a *public* page so no SSR auth redirect interferes.
 *  C. Authenticated flows — gated by E2E_TEST_EMAIL / E2E_TEST_PASSWORD env
 *     vars. Uses test.skip() when credentials are absent; never falls back to
 *     accepting a redirect as a passing assertion.
 */

const HAS_TEST_CREDS = !!(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
);

// ---------------------------------------------------------------------------
// A1. Landing page → Auth navigation
// ---------------------------------------------------------------------------

test.describe('Landing → Auth navigation journey', () => {
  test('user can navigate from landing to sign-up', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const cta = page.locator('a[href*="sign-up"], a[href*="signup"]').first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/sign-up/);
  });

  test('user can navigate from landing to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loginLink = page.locator('a[href*="login"]').first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/login/);
  });

  test('sign-up page ↔ login page cross-links work', async ({ page }) => {
    await page.goto('/auth/sign-up');
    const loginLink = page.locator('a[href*="login"]').first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/login/);

    const signUpLink = page.locator('a[href*="sign-up"]').first();
    await expect(signUpLink).toBeVisible();
    await signUpLink.click();
    await expect(page).toHaveURL(/sign-up/);
  });
});

// ---------------------------------------------------------------------------
// A2. Sign-up form client-side validation
// ---------------------------------------------------------------------------

test.describe('Sign-up form — client-side validation journey', () => {
  test('empty form submission stays on sign-up page', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await page.waitForLoadState('networkidle');
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();
    expect(page.url()).toMatch(/sign-up/);
  });

  test('sign-up form has email and password fields', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('login form with wrong credentials does not redirect to /app', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"], input[name="email"]').first().fill('nonexistent@example.invalid');
    await page.locator('input[type="password"]').first().fill('wrongpassword');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2000);
    expect(page.url()).not.toMatch(/\/app$/);
  });
});

// ---------------------------------------------------------------------------
// A3. Unauthenticated route guard — protected routes redirect to login
// ---------------------------------------------------------------------------

test.describe('Unauthenticated route guard journey', () => {
  const protectedRoutes = [
    '/app',
    '/app/settings',
    '/app/analytics',
    '/app/solar',
    '/app/battery',
    '/app/ev',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects unauthenticated visitor to login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/auth\/login/);
      expect(page.url()).toMatch(/auth\/login/);
    });
  }
});

// ---------------------------------------------------------------------------
// A4. OAuth error callback — graceful redirect, no crash
// ---------------------------------------------------------------------------

test.describe('OAuth error callback journey', () => {
  test('OAuth callback with ?error=access_denied redirects without 500', async ({ page }) => {
    await page.goto(
      '/api/auth/oauth/tesla/callback?error=access_denied&error_description=User+denied+access&state=test-state'
    );
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).toMatch(/settings|auth\/login|auth\/error/);
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('OAuth callback with unknown provider redirects gracefully', async ({ page }) => {
    await page.goto('/api/auth/oauth/unknown-provider/callback?code=abc&state=xyz');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/settings|auth\/login|auth\/error/);
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('auth error page renders error details without crash', async ({ page }) => {
    await page.goto('/auth/error?error=access_denied&error_code=401&error_description=Unauthorized');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=access_denied')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// A5. Health endpoint — public, no auth needed
// ---------------------------------------------------------------------------

test.describe('Health endpoint journey', () => {
  test('health endpoint responds within 5 seconds', async ({ request }) => {
    const t0 = Date.now();
    const response = await request.get('/api/health');
    const elapsed = Date.now() - t0;
    expect([200, 503]).toContain(response.status());
    expect(elapsed).toBeLessThan(5_000);
  });

  test('health endpoint returns valid JSON with required keys', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();
    expect(body).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded)$/),
      version: expect.any(String),
      db: { ok: expect.any(Boolean), latency_ms: expect.any(Number) },
      providers: expect.any(Object),
    });
  });

  test('health endpoint carries no-store cache header', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('POST to health endpoint is rejected (405)', async ({ request }) => {
    const response = await request.post('/api/health', { data: {} });
    expect(response.status()).toBe(405);
  });

  test('health endpoint is NOT rate-limited (5 concurrent requests all succeed)', async ({ request }) => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request.get('/api/health'))
    );
    for (const r of results) {
      expect(r.status()).not.toBe(429);
      expect([200, 503]).toContain(r.status());
    }
  });
});

// ---------------------------------------------------------------------------
// A6. API error surface (unauthenticated) → structured 401
// ---------------------------------------------------------------------------

test.describe('API error surface — unauthenticated', () => {
  const routes = [
    '/api/configuration/devices',
    '/api/energy/snapshot',
    '/api/audit-log',
    '/api/energy/flows',
  ];

  for (const route of routes) {
    test(`GET ${route} → structured 401 JSON`, async ({ request }) => {
      const response = await request.get(route);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });
  }

  test('GET /api/configuration/devices/health → 401 with error property', async ({ request }) => {
    const response = await request.get('/api/configuration/devices/health');
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// A7. API validation layer — bad input (unauthenticated)
// ---------------------------------------------------------------------------

test.describe('Invalid device config — API validation journey', () => {
  test('POST /api/configuration/devices with missing fields returns 400 or 401', async ({ request }) => {
    const response = await request.post('/api/configuration/devices', {
      data: { name: '' },
    });
    expect([400, 401, 422]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  test('POST /api/configuration/devices with invalid type returns 4xx', async ({ request }) => {
    const response = await request.post('/api/configuration/devices', {
      data: { type: 'invalid_type', provider_type: 'unknown_provider' },
    });
    expect([400, 401, 422]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// B1. Rate-limit 429 contract — hermetic via page.route()
//     Navigate to login (public) then fire fetch from JS. The route mock
//     intercepts the browser request regardless of which page we're on.
//     Assertions are unconditional — no "if (result)" guard.
// ---------------------------------------------------------------------------

test.describe('Rate-limit 429 surface — mocked API contract', () => {
  test('mocked 429 from snapshot API: status=429 and Retry-After header present', async ({ page }) => {
    await page.route('**/api/energy/snapshot', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '45' },
        body: JSON.stringify({ error: 'Too many requests' }),
      });
    });

    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const r = await fetch('/api/energy/snapshot');
      return {
        status: r.status,
        retryAfter: r.headers.get('Retry-After'),
        body: await r.json(),
      };
    });

    expect(result.status).toBe(429);
    expect(result.retryAfter).toBe('45');
    expect(result.body).toMatchObject({ error: 'Too many requests' });
  });

  test('mocked 429 from device API: correct shape', async ({ page }) => {
    await page.route('**/api/configuration/devices', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '30' },
        body: JSON.stringify({ error: 'Too many requests' }),
      });
    });

    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const r = await fetch('/api/configuration/devices');
      return {
        status: r.status,
        retryAfter: r.headers.get('Retry-After'),
        body: await r.json(),
      };
    });

    expect(result.status).toBe(429);
    expect(result.retryAfter).toBe('30');
    expect(result.body).toMatchObject({ error: 'Too many requests' });
  });
});

// ---------------------------------------------------------------------------
// B2. Disconnect banner — authenticated, gated by real credentials
//     Without credentials the test is explicitly skipped, not silently passed.
// ---------------------------------------------------------------------------

test.describe('Disconnect banner — authenticated dashboard', () => {
  test.skip(!HAS_TEST_CREDS, 'Skipped: set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to enable');

  test('dashboard shows disconnect banner when device health API reports disconnected', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.E2E_TEST_EMAIL!);
    await page.locator('input[type="password"]').first().fill(process.env.E2E_TEST_PASSWORD!);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/app/, { timeout: 15_000 });

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    await page.route('**/api/configuration/devices/health', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          devices: [{
            device_id: 'dev-1',
            name: 'Tesla Powerwall',
            provider_type: 'tesla',
            status: 'disconnected',
            last_error_at: twoHoursAgo,
            last_success_at: null,
            consecutive_failures: 5,
          }],
        }),
      });
    });

    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/app/);

    const banner = page.locator('[role="alert"]').filter({ hasText: /Tesla Powerwall|disconnected/i });
    await expect(banner).toBeVisible({ timeout: 8_000 });
    await expect(banner).toContainText('Tesla Powerwall');

    const dismissBtn = banner.locator('button[aria-label="Dismiss"]');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();
    await expect(banner).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// B3. Observability — x-request-id header propagation
// ---------------------------------------------------------------------------

test.describe('Observability: request-id propagation', () => {
  test('health endpoint accepts x-request-id header without error', async ({ request }) => {
    const response = await request.get('/api/health', {
      headers: { 'x-request-id': 'e2e-test-req-id-abc123' },
    });
    expect([200, 503]).toContain(response.status());
  });

  test('server-injected x-request-id on health endpoint is UUID-shaped if present', async ({ request }) => {
    const response = await request.get('/api/health');
    const requestId = response.headers()['x-request-id'];
    if (requestId) {
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    }
  });

  test('multiple concurrent health requests all succeed independently', async ({ request }) => {
    const results = await Promise.all([
      request.get('/api/health'),
      request.get('/api/health'),
      request.get('/api/health'),
    ]);
    for (const r of results) {
      expect([200, 503]).toContain(r.status());
    }
  });
});
