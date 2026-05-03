/**
 * GET /api/auth/oauth/providers
 *
 * Returns which OAuth providers have the necessary client credentials
 * configured via environment variables. The Settings UI uses this to decide
 * whether to render the "Connect with Tesla / Connect with Enphase" buttons
 * on Device Configuration cards — without the env vars the OAuth handshake
 * cannot succeed, so the button would be misleading.
 *
 * Required env vars per provider (see lib/server/oauth-providers.ts):
 *   tesla:   TESLA_CLIENT_ID
 *   enphase: ENPHASE_CLIENT_ID + ENPHASE_CLIENT_SECRET
 */

import { NextResponse } from 'next/server';
import { OAUTH_PROVIDERS, OAuthProvider } from '@/lib/server/oauth-providers';

export async function GET() {
  const available: Record<OAuthProvider, boolean> = {} as Record<OAuthProvider, boolean>;

  for (const [key, cfg] of Object.entries(OAUTH_PROVIDERS) as [OAuthProvider, typeof OAUTH_PROVIDERS[OAuthProvider]][]) {
    const hasId = !!process.env[cfg.clientIdEnv];
    const hasSecret = cfg.clientSecretEnv ? !!process.env[cfg.clientSecretEnv] : true;
    available[key] = hasId && hasSecret;
  }

  return NextResponse.json({ providers: available });
}
