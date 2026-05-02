import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodType, ZodTypeDef } from 'zod';

export interface ValidationError {
  error: string;
  details?: Record<string, string[]>;
}

function formatZodError(err: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    if (!out[key]) out[key] = [];
    out[key].push(issue.message);
  }
  return out;
}

export function validateBody<T>(
  schema: ZodSchema<T>,
  data: unknown
): { data: T; error: null } | { data: null; error: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Validation failed', details: formatZodError(result.error) } satisfies ValidationError & { details: Record<string, string[]> },
        { status: 400 }
      ),
    };
  }
  return { data: result.data, error: null };
}

export function validateQuery<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  searchParams: URLSearchParams
): { data: T; error: null } | { data: null; error: NextResponse } {
  const raw: Record<string, string> = {};
  searchParams.forEach((v, k) => { raw[k] = v; });
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Invalid query parameters', details: formatZodError(result.error) },
        { status: 400 }
      ),
    };
  }
  return { data: result.data, error: null };
}

export async function parseBody(req: NextRequest): Promise<{ data: unknown; error: null } | { data: null; error: NextResponse }> {
  try {
    const data = await req.json();
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}

export function validateParams<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  params: Record<string, string | undefined>
): { data: T; error: null } | { data: null; error: NextResponse } {
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Invalid route parameters', details: formatZodError(result.error) },
        { status: 400 }
      ),
    };
  }
  return { data: result.data, error: null };
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
