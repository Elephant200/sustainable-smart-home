import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { checkReadRateLimit } from '@/lib/api/rate-limit';
import { validateQuery } from '@/lib/api/validate';
import { createLogger } from '@/lib/logger';
import { z } from 'zod';

const AuditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export async function GET(req: NextRequest) {
  const hdrs = await headers();
  const log = createLogger({ route: '/api/audit-log', request_id: hdrs.get('x-request-id') ?? undefined });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimitError = checkReadRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const qr = validateQuery(AuditLogQuerySchema, req.nextUrl.searchParams);
  if (qr.error) return qr.error;

  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('id, action, device_id, actor_ip, metadata, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(qr.data.limit ?? 20);

  if (error) {
    log.error('audit_logs fetch error', { error: error.message, user_id: user.id });
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }

  return NextResponse.json({ logs: logs ?? [] });
}
