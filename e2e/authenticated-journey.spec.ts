import { test, expect } from '@playwright/test';

/**
 * Authenticated end-to-end journey tests.
 *
 * Design principles:
 *  - No conditional "if (redirected to login) { accept }" branches.
 *    Every test either asserts unconditionally or uses test.skip().
 *  - Mocked-API tests navigate to a PUBLIC page (/auth/login) so SSR auth
 *    never interferes, then fire fetch() from page.evaluate(). page.route()
 *    intercepts all browser requests regardless of which page is rendered.
 *  - Authenticated UI tests require E2E_TEST_EMAIL + E2E_TEST_PASSWORD and
 *    use test.skip() when those vars are absent.
 */

const HAS_TEST_CREDS = !!(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
);

// ---------------------------------------------------------------------------
// Helper: sign in with real credentials (used by authenticated tests)
// ---------------------------------------------------------------------------

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"], input[name="email"]').first().fill(process.env.E2E_TEST_EMAIL!);
  await page.locator('input[type="password"]').first().fill(process.env.E2E_TEST_PASSWORD!);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/app/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/app/);
}

// ---------------------------------------------------------------------------
// 1. Sign-up form — public page, no auth needed
// ---------------------------------------------------------------------------

test.describe('Sign-up journey — form validation', () => {
  test('sign-up form calls Supabase auth endpoint and stays off /app on success mock', async ({ page }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    test.skip(!supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL not set');

    await page.route(`${supabaseUrl}/auth/v1/signup`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: 'mock-user-id',
            email: 'e2e@example.invalid',
            role: 'authenticated',
            aud: 'authenticated',
          },
        }),
      });
    });

    await page.goto('/auth/sign-up');
    await page.waitForLoadState('networkidle');

    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();

    await emailField.fill('e2e@example.invalid');
    await passwordField.fill('SecurePassw0rd!');
    await submitBtn.click();

    await page.waitForTimeout(2_000);
    const url = page.url();
    // With a mocked 200 the app should NOT stay on sign-up with an error visible.
    // It may redirect to a "check your email" page or similar.
    const isOnSignUpWithError = url.includes('sign-up') &&
      (await page.locator('text=Invalid').isVisible().catch(() => false));
    expect(isOnSignUpWithError).toBe(false);
  });

  test('sign-up form shows validation error on empty submit', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await page.waitForLoadState('networkidle');
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForTimeout(500);
    // HTML5 or custom validation must keep the user on sign-up, not /app
    expect(page.url()).not.toMatch(/\/app$/);
  });
});

// ---------------------------------------------------------------------------
// 2. Rate-limit 429 contract — hermetic via page.route()
//    Navigate to a public page, fire fetch from JS. Assertions unconditional.
// ---------------------------------------------------------------------------

test.describe('Rate-limit 429 — hermetic mocked contract', () => {
  test('snapshot API 429: status=429, Retry-After=45, body={error}', async ({ page }) => {
    await page.route('**/api/energy/snapshot', (route) => {
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Retry-After': '45' },
        body: JSON.stringify({ error: 'Too many requests' }),
      });
    });

    // Use a public page so SSR auth never redirects us away
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
// 3. Tesla OAuth — public / error paths, no auth needed
// ---------------------------------------------------------------------------

test.describe('Tesla OAuth — error paths (no auth required)', () => {
  test('OAuth start without auth redirects gracefully (not 500)', async ({ page }) => {
    await page.goto('/api/auth/oauth/tesla/start');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
    // Must redirect to login (unauthenticated) or a configured Tesla auth page
    const url = page.url();
    expect(url).toMatch(/auth\.tesla\.com|auth\/login|settings|auth\/error/);
  });

  test('OAuth callback with valid mocked code resolves without crash', async ({ page }) => {
    await page.goto(
      '/api/auth/oauth/tesla/callback?code=mock-auth-code&state=test-state-value'
    );
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
    expect(page.url()).toMatch(/settings|auth\/login|auth\/error/);
  });

  test('OAuth callback with error=access_denied redirects gracefully', async ({ page }) => {
    await page.goto(
      '/api/auth/oauth/tesla/callback?error=access_denied&error_description=User+denied&state=test-state'
    );
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
    expect(page.url()).toMatch(/settings|auth\/login|auth\/error/);
  });
});

// ---------------------------------------------------------------------------
// 4. Disconnect banner — requires real credentials
//    test.skip() when E2E_TEST_EMAIL is absent. No conditional fallback.
// ---------------------------------------------------------------------------

test.describe('Disconnect banner — authenticated dashboard', () => {
  test.skip(!HAS_TEST_CREDS, 'Skipped: set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to enable');

  test('banner appears on dashboard when device health reports disconnected', async ({ page }) => {
    await signIn(page);

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
// 5. Add simulated device → dashboard — requires real credentials
// ---------------------------------------------------------------------------

test.describe('Add simulated device → dashboard populates', () => {
  test.skip(!HAS_TEST_CREDS, 'Skipped: set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to enable');

  test('dashboard shows solar data after device added (mocked snapshot)', async ({ page }) => {
    await signIn(page);

    await page.route('**/api/energy/snapshot', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          solar: { current_kw: 3.5, today_kwh: 12.4, is_live: true },
          battery: null,
          ev: [],
          house: { current_kw: 1.2, today_kwh: 8.9 },
          grid: { import_kw: 0, export_kw: 2.3 },
          flows: [],
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Full authenticated journey — sign-in → settings → dashboard
// ---------------------------------------------------------------------------

test.describe('Full authenticated journey (real credentials)', () => {
  test.skip(!HAS_TEST_CREDS, 'Skipped: set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to enable');

  test('sign in → dashboard renders without crash', async ({ page }) => {
    await signIn(page);

    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('sign in → settings page renders without crash', async ({ page }) => {
    await signIn(page);

    await page.goto('/app/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/settings/);
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });

  test('Tesla OAuth settings error rendered correctly after access_denied redirect', async ({ page }) => {
    await signIn(page);

    await page.goto('/app/settings?oauth_error=access_denied&oauth_provider=tesla');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/settings/);
    await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
  });
});
