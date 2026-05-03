-- Migration: Add device_sync_state table for per-device sync health tracking.
-- Records the last sync attempt, last success, and failure details for each
-- active non-simulated device so the settings page and dashboard can surface
-- connection health without re-querying provider APIs on every page load.

CREATE TABLE IF NOT EXISTS "public"."device_sync_state" (
    "device_id"             uuid NOT NULL,
    "user_id"               uuid NOT NULL,
    "last_sync_at"          timestamptz,
    "last_success_at"       timestamptz,
    "last_error_at"         timestamptz,
    "last_error_message"    text,
    "consecutive_failures"  integer DEFAULT 0 NOT NULL,
    "rate_limited_until"    timestamptz,
    "updated_at"            timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "device_sync_state_pkey" PRIMARY KEY ("device_id"),
    CONSTRAINT "device_sync_state_device_id_fkey"
        FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE,
    CONSTRAINT "device_sync_state_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."device_sync_state" OWNER TO "postgres";

COMMENT ON TABLE "public"."device_sync_state" IS
    'Per-device sync health: last attempt, last success, and failure streak. '
    'Written by the background sync cron; read by the settings health card '
    'and the dashboard disconnection banner.';

CREATE INDEX IF NOT EXISTS "idx_device_sync_state_user"
    ON "public"."device_sync_state" ("user_id");

ALTER TABLE "public"."device_sync_state" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own device sync state"
    ON "public"."device_sync_state"
    FOR SELECT
    USING (user_id = auth.uid());
