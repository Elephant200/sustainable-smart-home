import { test, expect } from '@playwright/test';

/**
 * E2E tests for public-facing (unauthenticated) pages.
 *
 * These verify that the landing page renders without JS errors and that
 * auth routes are reachable. They do not require a Supabase connection.
 */
test.describe('Public landing page', () => {
  test('landing page loads with 200', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('page title is set', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('no uncaught JS errors on landing page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Allow Supabase connection errors in CI (no DB) but not JS syntax errors
    const fatalErrors = errors.filter(
      (e) => !e.includes('supabase') && !e.includes('fetch')
    );
    expect(fatalErrors).toHaveLength(0);
  });

  test('primary CTA button is visible on landing page', async ({ page }) => {
    await page.goto('/');
    // Look for a prominent get-started / sign-up style CTA
    const cta = page.locator(
      'a[href*="sign-up"], a[href*="signup"], button:has-text("Get Started"), a:has-text("Get Started")'
    );
    await expect(cta.first()).toBeVisible();
  });
});

test.describe('Auth routes', () => {
  test('login page is reachable', async ({ page }) => {
    const response = await page.goto('/auth/login');
    expect(response?.status()).toBeLessThan(400);
  });

  test('sign-up page is reachable', async ({ page }) => {
    const response = await page.goto('/auth/sign-up');
    expect(response?.status()).toBeLessThan(400);
  });

  test('forgot-password page is reachable', async ({ page }) => {
    const response = await page.goto('/auth/forgot-password');
    expect(response?.status()).toBeLessThan(400);
  });
});

test.describe('Protected routes redirect to login', () => {
  test('/app redirects unauthenticated user to /auth/login', async ({ page }) => {
    await page.goto('/app');
    await page.waitForURL(/auth\/login|\/$/);
    const url = page.url();
    expect(url).toMatch(/auth\/login/);
  });

  test('/app/settings redirects unauthenticated user to /auth/login', async ({ page }) => {
    await page.goto('/app/settings');
    await page.waitForURL(/auth\/login/);
    const url = page.url();
    expect(url).toMatch(/auth\/login/);
  });
});
