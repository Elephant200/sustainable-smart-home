-- Migration: Add audit_logs table for security event tracking
-- Records credential changes, device add/remove/update, OAuth events, etc.

CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id"         uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id"    uuid NOT NULL,
    "device_id"  uuid,
    "action"     text NOT NULL,
    "actor_ip"   text,
    "metadata"   jsonb DEFAULT '{}' NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "audit_logs_device_id_fkey"
        FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE SET NULL
);

ALTER TABLE "public"."audit_logs" OWNER TO "postgres";

COMMENT ON TABLE "public"."audit_logs" IS
    'Immutable audit trail of credential changes, device CRUD, and OAuth events. '
    'metadata must never contain plaintext secrets.';

CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_created"
    ON "public"."audit_logs" ("user_id", "created_at" DESC);

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own audit logs"
    ON "public"."audit_logs"
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert own audit logs"
    ON "public"."audit_logs"
    FOR INSERT
    WITH CHECK (user_id = auth.uid());
