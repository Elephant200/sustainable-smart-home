import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from './validate';

describe('validateBody', () => {
  const schema = z.object({
    name: z.string().min(1),
    count: z.number().positive(),
  });

  test('returns parsed data for valid input', () => {
    const result = validateBody(schema, { name: 'test', count: 5 });
    assert.equal(result.error, null);
    assert.deepEqual(result.data, { name: 'test', count: 5 });
  });

  test('returns 400 error response for missing required field', async () => {
    const result = validateBody(schema, { name: 'test' });
    assert.ok(result.error !== null, 'should produce an error');
    assert.equal(result.data, null);
    assert.equal(result.error.status, 400);
    const body = await result.error.json();
    assert.equal(body.error, 'Validation failed');
    assert.ok('details' in body, 'details field expected');
    assert.ok(Array.isArray(body.details.count));
  });

  test('returns 400 error for wrong type', async () => {
    const result = validateBody(schema, { name: 'test', count: 'not-a-number' });
    assert.ok(result.error !== null);
    assert.equal(result.error.status, 400);
  });

  test('returns 400 error for empty name string', async () => {
    const result = validateBody(schema, { name: '', count: 1 });
    assert.ok(result.error !== null);
    const body = await result.error.json();
    assert.ok(body.details.name, 'name error expected');
  });

  test('returns 400 for strict schema with extra field', async () => {
    const strict = schema.strict();
    const result = validateBody(strict, { name: 'ok', count: 1, extra: 'bad' });
    assert.ok(result.error !== null);
    assert.equal(result.error.status, 400);
  });
});

describe('validateQuery', () => {
  const schema = z.object({
    range: z.enum(['24h', '7d', '3m', '1y']).default('24h'),
  });

  function sp(obj: Record<string, string>): URLSearchParams {
    return new URLSearchParams(obj);
  }

  test('returns default value when param is absent', () => {
    const result = validateQuery(schema, sp({}));
    assert.equal(result.error, null);
    assert.deepEqual((result.data as { range: string }).range, '24h');
  });

  test('returns parsed value for valid param', () => {
    const result = validateQuery(schema, sp({ range: '7d' }));
    assert.equal(result.error, null);
    assert.equal((result.data as { range: string }).range, '7d');
  });

  test('returns 400 for invalid enum value', async () => {
    const result = validateQuery(schema, sp({ range: 'invalid' }));
    assert.ok(result.error !== null);
    assert.equal(result.error.status, 400);
    const body = await result.error.json();
    assert.equal(body.error, 'Invalid query parameters');
  });

  test('strict empty schema rejects extra params', async () => {
    const noQ = z.object({}).strict();
    const result = validateQuery(noQ, sp({ unexpected: 'value' }));
    assert.ok(result.error !== null);
    assert.equal(result.error.status, 400);
  });
});

describe('validateParams', () => {
  const schema = z.object({ id: z.string().uuid() });

  test('returns parsed data for valid UUID', () => {
    const result = validateParams(schema, { id: '550e8400-e29b-41d4-a716-446655440000' });
    assert.equal(result.error, null);
    assert.equal((result.data as { id: string }).id, '550e8400-e29b-41d4-a716-446655440000');
  });

  test('returns 400 for non-UUID string', async () => {
    const result = validateParams(schema, { id: 'not-a-uuid' });
    assert.ok(result.error !== null);
    assert.equal(result.error.status, 400);
    const body = await result.error.json();
    assert.equal(body.error, 'Invalid route parameters');
  });

  test('returns 400 for missing param', async () => {
    const result = validateParams(schema, {});
    assert.ok(result.error !== null);
    assert.equal(result.error.status, 400);
  });
});
