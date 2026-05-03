import { test, expect } from '@playwright/test';

/**
 * E2E tests for authentication pages.
 *
 * These tests exercise the login and sign-up page UIs without submitting real
 * credentials. They verify form structure, validation feedback, and navigation
 * links. No Supabase session is required.
 */
test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('displays email and password inputs', async ({ page }) => {
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('has a submit button', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('shows error feedback on empty submit', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    const hasHtml5Validation = validationMessage.length > 0;
    const errorVisible = await page
      .locator('[role="alert"], .error, [data-error]')
      .isVisible()
      .catch(() => false);
    expect(hasHtml5Validation || errorVisible).toBe(true);
  });

  test('has a link to the sign-up page', async ({ page }) => {
    const signUpLink = page.locator('a[href*="sign-up"]');
    await expect(signUpLink).toBeVisible();
  });

  test('has a link to forgot-password', async ({ page }) => {
    const forgotLink = page.locator('a[href*="forgot-password"]');
    await expect(forgotLink).toBeVisible();
  });

  test('typing invalid email shows validation error', async ({ page }) => {
    await page.fill('input[type="email"], input[name="email"]', 'not-an-email');
    await page.fill('input[type="password"]', 'somepassword');
    await page.locator('button[type="submit"]').click();
    // HTML5 type="email" will reject this natively
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage.length).toBeGreaterThan(0);
  });
});

test.describe('Sign-up page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/sign-up');
  });

  test('displays email and password inputs', async ({ page }) => {
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('has a submit button', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('has a link back to the login page', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"]');
    await expect(loginLink).toBeVisible();
  });

  test('shows validation on empty submit', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    const errorVisible = await page
      .locator('[role="alert"], .error, [data-error]')
      .isVisible()
      .catch(() => false);
    expect(validationMessage.length > 0 || errorVisible).toBe(true);
  });
});
