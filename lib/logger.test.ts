import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { createLogger } from './logger';

describe('createLogger', () => {
  function captureOutput(fn: () => void): string[] {
    const lines: string[] = [];
    const origStdout = process.stdout.write.bind(process.stdout);
    const origStderr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk: string | Uint8Array) => {
      lines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array) => {
      lines.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
      return true;
    };
    try { fn(); } finally {
      process.stdout.write = origStdout;
      process.stderr.write = origStderr;
    }
    return lines;
  }

  test('emits valid JSON for info level', () => {
    const log = createLogger({ route: '/api/test' });
    const lines = captureOutput(() => log.info('hello world'));
    assert.ok(lines.length > 0, 'should write at least one line');
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.msg, 'hello world');
    assert.equal(parsed.route, '/api/test');
    assert.ok(parsed.ts, 'ts field should be present');
  });

  test('emits valid JSON for error level', () => {
    const log = createLogger({ route: '/api/test', user_id: 'u123' });
    const lines = captureOutput(() => log.error('something failed', { detail: 'oops' }));
    assert.ok(lines.length > 0);
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.level, 'error');
    assert.equal(parsed.user_id, 'u123');
    assert.equal(parsed.detail, 'oops');
  });

  test('redacts sensitive keys from extra fields', () => {
    const log = createLogger({});
    const lines = captureOutput(() =>
      log.info('credential event', {
        access_token: 'super-secret',
        api_key: 'also-secret',
        safe_field: 'visible',
      })
    );
    assert.ok(lines.length > 0);
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.access_token, '[redacted]', 'access_token should be redacted');
    assert.equal(parsed.api_key, '[redacted]', 'api_key should be redacted');
    assert.equal(parsed.safe_field, 'visible', 'safe_field should pass through');
  });

  test('redacts __encrypted key', () => {
    const log = createLogger({});
    const lines = captureOutput(() =>
      log.warn('config debug', { __encrypted: 'v1:iv:tag:ct' })
    );
    assert.ok(lines.length > 0);
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.__encrypted, '[redacted]');
  });

  test('redacts nested sensitive fields', () => {
    const log = createLogger({});
    const lines = captureOutput(() =>
      log.debug('nested', { creds: { access_token: 'secret', public: 'ok' } })
    );
    assert.ok(lines.length > 0);
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.creds.access_token, '[redacted]');
    assert.equal(parsed.creds.public, 'ok');
  });

  test('child() inherits parent context', () => {
    const log = createLogger({ route: '/api/parent', request_id: 'req-1' });
    const child = log.child({ provider: 'tesla' });
    const lines = captureOutput(() => child.info('child log'));
    assert.ok(lines.length > 0);
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.route, '/api/parent');
    assert.equal(parsed.request_id, 'req-1');
    assert.equal(parsed.provider, 'tesla');
  });

  test('includes all four log levels without throwing', () => {
    const log = createLogger({});
    assert.doesNotThrow(() => {
      captureOutput(() => {
        log.debug('d');
        log.info('i');
        log.warn('w');
        log.error('e');
      });
    });
  });
});
