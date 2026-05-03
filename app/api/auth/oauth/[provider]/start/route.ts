/**
 * GET /api/auth/oauth/[provider]/start
 *
 * Initiates the OAuth handshake for a supported provider (tesla, enphase).
 * Generates a CSRF-protection `state` parameter stored in a short-lived
 * HttpOnly cookie, generates a PKCE pair when the provider requires it, and
 * redirects the user to the provider's authorization URL.
 *
 * Query params:
 *   device_id  (required) — UUID of the device record to associate tokens with
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
  isOAuthProvider,
  OAUTH_PROVIDERS,
  generateState,
  generatePkce,
} from '@/lib/server/oauth-providers';
import { checkWriteRateLimit } from '@/lib/api/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/auth/oauth/[provider]/start' });

const COOKIE_MAX_AGE_SEC = 600;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: `Unknown OAuth provider: ${provider}` }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reqLog = log.child({
    request_id: req.headers.get('x-request-id') ?? undefined,
    user_id: user.id,
  });
  reqLog.info('oauth start', { provider });

  const rateLimitError = checkWriteRateLimit(req, user.id);
  if (rateLimitError) return rateLimitError;

  const deviceId = req.nextUrl.searchParams.get('device_id');
  if (!deviceId) {
    return NextResponse.json({ error: 'device_id query parameter is required' }, { status: 400 });
  }

  const { data: device } = await supabase
    .from('devices')
    .select('id, user_id, provider_type')
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .single();

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  // Verify the device's provider_type matches the OAuth provider being initiated.
  // This prevents tokens from one provider being persisted onto the wrong device.
  if (device.provider_type !== provider) {
    return NextResponse.json(
      { error: `Device provider_type "${device.provider_type}" does not match OAuth provider "${provider}"` },
      { status: 400 }
    );
  }

  const cfg = OAUTH_PROVIDERS[provider];

  // Fail loudly when the OAuth client credentials aren't configured. Without
  // this guard we'd redirect the user to the provider with an empty
  // `client_id=` query param, and the provider responds with its own HTML
  // error page — confusing UX and a JSON parse error in the dev overlay if
  // any in-flight client fetch races with the navigation.
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = cfg.clientSecretEnv ? process.env[cfg.clientSecretEnv] : 'n/a';
  if (!clientId || !clientSecret) {
    reqLog.warn('OAuth provider not configured', {
      provider,
      missing: !clientId ? cfg.clientIdEnv : cfg.clientSecretEnv,
    });
    return NextResponse.json(
      {
        error: `OAuth provider "${provider}" is not configured on this server. ` +
          `The administrator needs to set ${cfg.clientIdEnv}` +
          (cfg.clientSecretEnv ? ` and ${cfg.clientSecretEnv}` : '') +
          '.',
      },
      { status: 503 }
    );
  }

  const state = generateState();

  const cookieStore = await cookies();
  const cookiePrefix = `oauth_${provider}`;

  cookieStore.set(`${cookiePrefix}_state`, state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_SEC,
    path: '/',
  });

  cookieStore.set(`${cookiePrefix}_device_id`, deviceId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_SEC,
    path: '/',
  });

  const redirectUri = buildRedirectUri(req, provider);

  const authUrl = new URL(cfg.authUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  if (cfg.scopes) {
    authUrl.searchParams.set('scope', cfg.scopes);
  }

  if (cfg.pkce) {
    const { codeVerifier, codeChallenge } = await generatePkce();
    cookieStore.set(`${cookiePrefix}_code_verifier`, codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_SEC,
      path: '/',
    });
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
  }

  return NextResponse.redirect(authUrl.toString());
}

function buildRedirectUri(req: NextRequest, provider: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return `${origin}/api/auth/oauth/${provider}/callback`;
}
