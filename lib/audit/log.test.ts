import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * Unit tests for the audit-log helper.
 *
 * recordAuditEvent is designed to never propagate errors to callers — if the
 * DB is unavailable, the call silently swallows the error.  These tests verify
 * that contract without requiring a live Supabase connection.
 *
 * We cannot easily mock createServiceClient() at the module level in the
 * Node.js built-in test runner (no jest.mock / vi.mock equivalent), so tests
 * instead rely on the fact that the helper catches all errors internally.
 * When NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset (as in
 * CI), createServiceClient() throws — and recordAuditEvent must still resolve
 * without propagating that throw to the test.
 */

describe('recordAuditEvent', () => {
  test('does not throw when called with full params (DB may be unavailable)', async () => {
    const { recordAuditEvent } = await import('./log');
    let threw = false;
    try {
      await recordAuditEvent({
        userId: 'user-123',
        action: 'device.create',
        deviceId: 'device-456',
        actorIp: '1.2.3.4',
        metadata: { name: 'Solar Panel', type: 'solar_array' },
      });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, 'recordAuditEvent should never throw');
  });

  test('does not throw when called with minimal params', async () => {
    const { recordAuditEvent } = await import('./log');
    let threw = false;
    try {
      await recordAuditEvent({
        userId: 'user-abc',
        action: 'device.delete',
      });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, 'recordAuditEvent must never propagate errors');
  });

  test('does not throw when deviceId is null', async () => {
    const { recordAuditEvent } = await import('./log');
    let threw = false;
    try {
      await recordAuditEvent({
        userId: 'user-xyz',
        action: 'credential.write',
        deviceId: null,
        metadata: { provider_type: 'tesla' },
      });
    } catch {
      threw = true;
    }
    assert.equal(threw, false);
  });

  test('does not throw when actorIp is null', async () => {
    const { recordAuditEvent } = await import('./log');
    let threw = false;
    try {
      await recordAuditEvent({
        userId: 'user-1',
        action: 'oauth.connect',
        actorIp: null,
      });
    } catch {
      threw = true;
    }
    assert.equal(threw, false);
  });

  test('accepts all defined action types without throwing', async () => {
    const { recordAuditEvent } = await import('./log');
    const actions = [
      'device.create',
      'device.update',
      'device.delete',
      'credential.write',
      'oauth.connect',
      'oauth.disconnect',
      'command.send',
      'location.update',
    ] as const;

    for (const action of actions) {
      let threw = false;
      try {
        await recordAuditEvent({ userId: 'u', action });
      } catch {
        threw = true;
      }
      assert.equal(threw, false, `action ${action} should not throw`);
    }
  });

  test('resolves (returns undefined) even when DB insert fails', async () => {
    const { recordAuditEvent } = await import('./log');
    const result = await recordAuditEvent({
      userId: 'u',
      action: 'command.send',
      deviceId: 'd',
    });
    assert.equal(result, undefined, 'recordAuditEvent should return void');
  });
});
