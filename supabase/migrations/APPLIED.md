# Production Migration Application Log

This file tracks which migrations in this directory have been applied to the
production Supabase project (`nivdoaomtsnhpawognne`). Update this log whenever
a new migration is run against production.

| Migration file | Applied to production | Method | Notes |
| --- | --- | --- | --- |
| `001_add_provider_type.sql` | yes (date unrecorded) | — | Pre-existing |
| `002_add_audit_logs.sql` | **NO** | — | Verified 2026-05-03 via `GET /rest/v1/audit_logs` → 404 "relation \"public.audit_logs\" does not exist". Previous "yes" entry was inaccurate. Needs re-applying via Supabase Dashboard SQL Editor. While this is missing, `/api/audit-log` returns 500 and every server-side `recordAuditEvent` call silently fails (it is wrapped in try/catch in `lib/audit/log.ts`). |
| `003_audit_logs_service_role_only.sql` | **NO** | — | Depends on 002. Apply 002 first, then 003. |
| `004_device_sync_state.sql` | 2026-05-03 | Supabase Dashboard SQL Editor | Task #28. Verified via REST: table readable, insert with FK to `devices` + `auth.users` succeeds, delete returns 204. |
