CREATE TYPE "public"."device_type" AS ENUM (
    'solar_array',
    'battery',
    'ev',
    'grid',
    'house'
);

ALTER TYPE "public"."device_type" OWNER TO "postgres";

CREATE TYPE "public"."resolution" AS ENUM (
    '1hr',
    '6hr',
    '1d',
    '7d'
);

ALTER TYPE "public"."resolution" OWNER TO "postgres";

CREATE TYPE "public"."theme" AS ENUM (
    'light',
    'dark',
    'system'
);

ALTER TYPE "public"."theme" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."battery_config" (
    "device_id" "uuid" NOT NULL,
    "capacity_kwh" double precision NOT NULL,
    "max_flow_kw" double precision NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."battery_config" OWNER TO "postgres";

COMMENT ON TABLE "public"."battery_config" IS 'Stores configuration for batteries';

CREATE TABLE IF NOT EXISTS "public"."battery_state" (
    "device_id" "uuid" NOT NULL,
    "soc_percent" double precision NOT NULL,
    "soc_kwh" double precision NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "battery_state_soc_percent_check" CHECK ((("soc_percent" >= (0)::double precision) AND ("soc_percent" <= (100)::double precision)))
);

ALTER TABLE "public"."battery_state" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."device_type" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);

ALTER TABLE "public"."devices" OWNER TO "postgres";

COMMENT ON TABLE "public"."devices" IS 'Lists each energy-relevant device (solar array, battery, EV, etc.) a user has.';

CREATE TABLE IF NOT EXISTS "public"."carbon_thresholds" (
  "user_id" uuid DEFAULT "auth"."uid"() NOT NULL,
  "low_ci"  double precision,
  "high_ci" double precision,
  "daylight_start" time DEFAULT '08:00',
  "daylight_end"   time DEFAULT '18:00',
  "updated_at"     timestamptz DEFAULT now()
);

ALTER TABLE "public"."carbon_thresholds" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."energy_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "source_device_id" "uuid" NOT NULL,
    "target_device_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "target" "text" NOT NULL,
    "energy_kwh" double precision NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "resolution" "public"."resolution" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."energy_flows" OWNER TO "postgres";

COMMENT ON TABLE "public"."energy_flows" IS 'Stores the flow of energy between various devices';

CREATE TABLE IF NOT EXISTS "public"."ev_charge_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "uuid" NOT NULL,
    "soc_percent" double precision,
    "energy_kwh_from_solar" double precision DEFAULT 0,
    "energy_kwh_from_grid" double precision DEFAULT 0,
    "energy_kwh_from_battery" double precision DEFAULT 0,
    "plugged_in" boolean DEFAULT true NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "resolution" "public"."resolution" DEFAULT '1hr'::"public"."resolution" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ev_charge_sessions_soc_percent_check" CHECK ((("soc_percent" >= (0)::double precision) AND ("soc_percent" <= (100)::double precision)))
);

ALTER TABLE "public"."ev_charge_sessions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."ev_config" (
    "device_id" "uuid" NOT NULL,
    "battery_capacity_kwh" double precision NOT NULL,
    "target_charge" double precision NOT NULL,
    "departure_time" time with time zone NOT NULL,
    "charger_power_kw" double precision NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."ev_config" OWNER TO "postgres";

COMMENT ON TABLE "public"."ev_config" IS 'Configuration for EVs';

CREATE TABLE IF NOT EXISTS "public"."grid_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "grid_carbon_intensity" double precision NOT NULL,
    "zone" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."grid_data" OWNER TO "postgres";

COMMENT ON TABLE "public"."grid_data" IS 'Contains information about the power grid in various locations';

CREATE TABLE IF NOT EXISTS "public"."house_load" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    "resolution" "public"."resolution" NOT NULL,
    "energy_kwh" double precision NOT NULL,
    "hypothetical_co2_g" double precision,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."house_load" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "zone_key" "text" NOT NULL,
    "configured" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."solar_config" (
    "device_id" "uuid" NOT NULL,
    "panel_count" bigint NOT NULL,
    "output_per_panel_kw" double precision NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."solar_config" OWNER TO "postgres";

COMMENT ON TABLE "public"."solar_config" IS 'Configuration for solar panels';

ALTER TABLE ONLY "public"."carbon_thresholds"
    ADD CONSTRAINT "carbon_thresholds_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."battery_config"
    ADD CONSTRAINT "battery_config_pkey" PRIMARY KEY ("device_id");

ALTER TABLE ONLY "public"."battery_state"
    ADD CONSTRAINT "battery_state_pkey" PRIMARY KEY ("device_id", "timestamp");

ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."energy_flows"
    ADD CONSTRAINT "energy_flows_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ev_charge_sessions"
    ADD CONSTRAINT "ev_charge_sessions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ev_config"
    ADD CONSTRAINT "ev_config_pkey" PRIMARY KEY ("device_id");

ALTER TABLE ONLY "public"."grid_data"
    ADD CONSTRAINT "grid_data_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."house_load"
    ADD CONSTRAINT "house_load_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."solar_config"
    ADD CONSTRAINT "solar_config_pkey" PRIMARY KEY ("device_id");

CREATE INDEX "idx_battery_state_timestamp" ON "public"."battery_state" USING "btree" ("timestamp");

CREATE INDEX "idx_ev_sessions_user_time" ON "public"."ev_charge_sessions" USING "btree" ("user_id", "timestamp");

CREATE INDEX "idx_house_load_user_time" ON "public"."house_load" USING "btree" ("user_id", "timestamp");

ALTER TABLE ONLY "public"."carbon_thresholds"
    ADD CONSTRAINT "carbon_thresholds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."battery_config"
    ADD CONSTRAINT "battery_config_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."battery_state"
    ADD CONSTRAINT "battery_state_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."energy_flows"
    ADD CONSTRAINT "energy_flows_source_device_id_fkey" FOREIGN KEY ("source_device_id") REFERENCES "public"."devices"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."energy_flows"
    ADD CONSTRAINT "energy_flows_target_device_id_fkey" FOREIGN KEY ("target_device_id") REFERENCES "public"."devices"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."energy_flows"
    ADD CONSTRAINT "energy_flows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ev_charge_sessions"
    ADD CONSTRAINT "ev_charge_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ev_charge_sessions"
    ADD CONSTRAINT "ev_charge_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ev_config"
    ADD CONSTRAINT "ev_config_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."house_load"
    ADD CONSTRAINT "house_load_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."solar_config"
    ADD CONSTRAINT "solar_config_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON UPDATE CASCADE ON DELETE CASCADE;

CREATE POLICY "Enable actions for users based on user_id" ON "public"."profiles" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable actions for users based on user_id" ON "public"."carbon_thresholds" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable read access for all users" ON "public"."grid_data" FOR SELECT USING (true);

CREATE POLICY "Users can access their EV config" ON "public"."ev_config" USING ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "ev_config"."device_id") AND ("devices"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "ev_config"."device_id") AND ("devices"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can access their EV sessions" ON "public"."ev_charge_sessions" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can access their battery config" ON "public"."battery_config" USING ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "battery_config"."device_id") AND ("devices"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "battery_config"."device_id") AND ("devices"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can access their battery state" ON "public"."battery_state" USING ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "battery_state"."device_id") AND ("devices"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "battery_state"."device_id") AND ("devices"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can access their house load data" ON "public"."house_load" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can access their own devices" ON "public"."devices" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can access their solar config" ON "public"."solar_config" USING ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "solar_config"."device_id") AND ("devices"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."devices"
  WHERE (("devices"."id" = "solar_config"."device_id") AND ("devices"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can perform actions on their own devices" ON "public"."energy_flows" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

ALTER TABLE "public"."battery_config" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."battery_state" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."devices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."energy_flows" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ev_charge_sessions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ev_config" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."grid_data" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."house_load" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."solar_config" ENABLE ROW LEVEL SECURITY;