-- Migration: Add provider_type and connection_config to devices table
-- This supports the generic device adapter layer which allows real smart home
-- hardware (Tesla, Enphase, Home Assistant, SolarEdge, Emporia) to be connected.

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS provider_type TEXT NOT NULL DEFAULT 'simulated';

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS connection_config JSONB NOT NULL DEFAULT '{}';

-- Add a check constraint to validate provider_type values
ALTER TABLE public.devices
  ADD CONSTRAINT devices_provider_type_check
  CHECK (provider_type IN ('simulated', 'tesla', 'enphase', 'home_assistant', 'solaredge', 'emporia'));

-- Index for filtering devices by provider type
CREATE INDEX IF NOT EXISTS idx_devices_provider_type
  ON public.devices (user_id, provider_type);

COMMENT ON COLUMN public.devices.provider_type IS
  'Which real-hardware provider this device maps to, or "simulated" for demo data.';

COMMENT ON COLUMN public.devices.connection_config IS
  'Encrypted JSON blob containing provider-specific credentials (API keys, tokens, URLs). Never logged or returned to the client in full.';
