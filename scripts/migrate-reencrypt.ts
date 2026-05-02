#!/usr/bin/env node
/**
 * Re-encryption migration: upgrades every connection_config row from any
 * older key version to the CURRENT_KEY_VERSION defined in connection-config.ts.
 *
 * Supported transitions:
 *   - legacy unversioned (iv:tag:ciphertext)     → current version
 *   - any older versioned format (vN:iv:tag:ct)  → current version
 *   - rows already on current version              → skipped
 *
 * Safe to run multiple times — rows already on the current version are skipped.
 *
 * Usage:
 *   npm run migrate:reencrypt
 *
 * Requires:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - CONNECTION_CONFIG_SECRET          (current v1 key, always required)
 *   - CONNECTION_CONFIG_SECRET_V2       (if rotating to v2)
 */

import { createClient } from '@supabase/supabase-js';
import {
  decryptConnectionConfig,
  encryptConnectionConfig,
  CURRENT_KEY_VERSION,
} from '../lib/crypto/connection-config';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  console.log(`Target key version: ${CURRENT_KEY_VERSION}`);
  console.log('Fetching all devices with connection_config...');

  const { data: devices, error } = await supabase
    .from('devices')
    .select('id, connection_config')
    .neq('connection_config', '{}');

  if (error) {
    console.error('Failed to fetch devices:', error.message);
    process.exit(1);
  }

  console.log(`Found ${devices?.length ?? 0} devices to inspect.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const device of devices ?? []) {
    const cfg = device.connection_config as Record<string, unknown>;
    const encrypted = cfg?.__encrypted;

    if (typeof encrypted !== 'string' || encrypted.length === 0) {
      skipped++;
      continue;
    }

    const parts = encrypted.split(':');

    // Already on the current version — skip without re-encrypting.
    if (parts.length === 4 && parts[0] === CURRENT_KEY_VERSION) {
      skipped++;
      continue;
    }

    // Unexpected format (not 3-part legacy or 4-part versioned).
    if (parts.length !== 3 && parts.length !== 4) {
      console.warn(`  Device ${device.id}: unexpected format "${encrypted.slice(0, 30)}…" — skipping`);
      skipped++;
      continue;
    }

    const plaintext = decryptConnectionConfig(cfg);
    if (Object.keys(plaintext).length === 0) {
      console.warn(`  Device ${device.id}: decryption returned empty — skipping`);
      failed++;
      continue;
    }

    const reencrypted = encryptConnectionConfig(plaintext);

    const { error: updateError } = await supabase
      .from('devices')
      .update({ connection_config: reencrypted })
      .eq('id', device.id);

    if (updateError) {
      console.error(`  Device ${device.id}: update failed — ${updateError.message}`);
      failed++;
    } else {
      console.log(`  Device ${device.id}: migrated to ${CURRENT_KEY_VERSION}`);
      migrated++;
    }
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
