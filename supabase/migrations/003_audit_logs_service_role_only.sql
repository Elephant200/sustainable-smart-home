-- Migration: Restrict audit_logs INSERT to service role only.
-- Removes the authenticated-client INSERT policy so that audit entries can
-- only be written via the server-side service-role client, preventing
-- authenticated users from forging or spamming their own audit trail.
-- READ access (SELECT) for the row owner is preserved.

DROP POLICY IF EXISTS "Authenticated users can insert own audit logs" ON "public"."audit_logs";
