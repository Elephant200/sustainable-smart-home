/**
 * Per-provider polling cadence and rate-limit configuration.
 *
 * Intervals are deliberately conservative to stay within each provider's
 * documented or observed rate limits. The cron sync route reads these to
 * decide whether a device is due for a refresh and to back off on 429s.
 *
 * How to add a new provider:
 *   1. Add its ProviderType to the map below.
 *   2. Set minIntervalSec to the provider's minimum polling cadence
 *      (use the documented rate limit; if none is published, 300s is safe).
 *   3. Document the source of the rate limit in a comment.
 */

import type { ProviderType } from '@/lib/adapters/types';

export interface PollingConfig {
  /** Minimum seconds between successful polls for this provider. */
  minIntervalSec: number;
  /** How many seconds to wait after a 429 before retrying. */
  backoffOnRateLimitSec: number;
  /** History window to pull on each sync (seconds back from now). */
  historyWindowSec: number;
}

/**
 * Default config used for providers not listed below.
 * 5 minutes is a safe default for most monitoring APIs.
 */
const DEFAULT_CONFIG: PollingConfig = {
  minIntervalSec: 300,
  backoffOnRateLimitSec: 900,
  historyWindowSec: 3600,
};

/**
 * Provider-specific configs. Sources:
 *   Tesla:      Fleet API docs recommend max 1 req/min per site endpoint.
 *   Enphase:    Enlighten v4 rate limit is 10 req/min; conservatively 15min.
 *   SolarEdge:  Monitoring API allows 300 req/day per site → ~5min minimum.
 *   Emporia:    Unofficial API — no published limit; use 5min to be safe.
 *   HA:         Self-hosted; 30s is fine (local network, no external quota).
 */
const PROVIDER_CONFIGS: Partial<Record<ProviderType, PollingConfig>> = {
  tesla: {
    minIntervalSec: 60,       // 1 request/min per site
    backoffOnRateLimitSec: 300,
    historyWindowSec: 3600,
  },
  enphase: {
    minIntervalSec: 900,      // 15 minutes (10 req/min, but telemetry updates at 15-min cadence)
    backoffOnRateLimitSec: 1800,
    historyWindowSec: 3600,
  },
  solaredge: {
    minIntervalSec: 900,      // 300 req/day ≈ 1 req per 4.8 min; use 15 min for headroom
    backoffOnRateLimitSec: 1800,
    historyWindowSec: 3600,
  },
  emporia: {
    minIntervalSec: 300,      // Unofficial API, no published limit; 5 min is safe
    backoffOnRateLimitSec: 900,
    historyWindowSec: 3600,
  },
  home_assistant: {
    minIntervalSec: 30,       // Self-hosted; low latency, no external quota
    backoffOnRateLimitSec: 120,
    historyWindowSec: 3600,
  },
};

export function getPollingConfig(providerType: ProviderType): PollingConfig {
  return PROVIDER_CONFIGS[providerType] ?? DEFAULT_CONFIG;
}

/**
 * Returns true when a device is due for a sync based on its last_sync_at
 * timestamp and the provider's minimum polling interval. Also returns true
 * when last_sync_at is null (never synced) or the device had consecutive
 * failures < 5 (keep retrying with backoff handled by the cron interval).
 */
export function isDueForSync(
  providerType: ProviderType,
  lastSyncAt: Date | null,
  consecutiveFailures: number
): boolean {
  const cfg = getPollingConfig(providerType);
  if (!lastSyncAt) return true;

  const elapsedSec = (Date.now() - lastSyncAt.getTime()) / 1000;

  // Apply exponential backoff for repeated failures, capped at 4× the
  // normal interval so a broken device doesn't disappear from the sync
  // queue entirely — the UI should continue to show a fresh error message.
  const effectiveMinInterval =
    consecutiveFailures > 0
      ? Math.min(cfg.minIntervalSec * Math.pow(2, consecutiveFailures - 1), cfg.minIntervalSec * 4)
      : cfg.minIntervalSec;

  return elapsedSec >= effectiveMinInterval;
}
