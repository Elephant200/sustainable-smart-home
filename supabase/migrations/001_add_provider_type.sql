-- Migration: Add provider_type and connection_config to devices table
-- This supports the generic device adapter layer which allows real smart home
-- hardware (Tesla, Enphase, Home Assistant, SolarEdge, Emporia) to be connected.

-- Create the provider_type enum
CREATE TYPE public.provider_type AS ENUM (
    'simulated',
    'tesla',
    'enphase',
    'home_assistant',
    'solaredge',
    'emporia'
);

ALTER TYPE public.provider_type OWNER TO postgres;

-- Add columns to the devices table
ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS provider_type public.provider_type NOT NULL DEFAULT 'simulated';

ALTER TABLE public.devices
    ADD COLUMN IF NOT EXISTS connection_config JSONB NOT NULL DEFAULT '{}';

-- Index for filtering devices by provider type
CREATE INDEX IF NOT EXISTS idx_devices_provider_type
    ON public.devices (user_id, provider_type);

COMMENT ON COLUMN public.devices.provider_type IS
    'Which real-hardware provider this device maps to, or "simulated" for demo data.';

COMMENT ON COLUMN public.devices.connection_config IS
    'AES-256-GCM encrypted JSON blob containing provider-specific credentials. '
    'Format: { "__encrypted": "iv:authTag:ciphertext" }. '
    'Never returned to the client; decrypted server-side only. '
    'Encryption key: CONNECTION_CONFIG_SECRET environment variable.';
