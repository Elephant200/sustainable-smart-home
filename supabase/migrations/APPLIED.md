# Production Migration Application Log

This file tracks which migrations in this directory have been applied to the
production Supabase project (`nivdoaomtsnhpawognne`). Update this log whenever
a new migration is run against production.

| Migration file | Applied to production | Method | Notes |
| --- | --- | --- | --- |
| `001_add_provider_type.sql` | yes (date unrecorded) | — | Pre-existing |
| `002_add_audit_logs.sql` | yes (date unrecorded) | — | Pre-existing |
| `003_audit_logs_service_role_only.sql` | yes (date unrecorded) | — | Pre-existing |
| `004_device_sync_state.sql` | 2026-05-03 | Supabase Dashboard SQL Editor | Task #28. Verified via REST: table readable, insert with FK to `devices` + `auth.users` succeeds, delete returns 204. |
