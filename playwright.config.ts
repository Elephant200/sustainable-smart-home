import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for end-to-end tests.
 *
 * Tests live in e2e/ and run against the dev server (or BASE_URL env var
 * for CI / deployed environments).
 *
 * Run:
 *   npm run test:e2e              — headless Chromium
 *   npm run test:e2e -- --headed  — headed (shows browser)
 *   npm run test:e2e -- --ui      — Playwright UI mode
 *
 * Browser binaries must be installed once:
 *   npx playwright install --with-deps chromium firefox
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Automatically start the Next.js dev server before running tests.
  // If BASE_URL is set (e.g. in CI against a deployed URL), skip this.
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
