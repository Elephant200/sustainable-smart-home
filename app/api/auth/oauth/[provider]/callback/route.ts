/**
 * GET /api/auth/oauth/[provider]/callback
 *
 * Receives the authorization code redirect from the OAuth provider, verifies
 * the `state` parameter against the cookie set by /start, exchanges the code
 * for tokens, encrypts and persists them to the device's connection_config,
 * records an audit event, and redirects the user to the settings page.
 *
 * Supported providers: tesla, enphase
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { encryptConnectionConfig, decryptConnectionConfig } from '@/lib/crypto/connection-config';
import { recordAuditEvent } from '@/lib/audit/log';
import { isOAuthProvider, OAUTH_PROVIDERS } from '@/lib/server/oauth-providers';
import { getClientIp } from '@/lib/api/validate';

const SETTINGS_URL = '/app/settings';
const REQUEST_TIMEOUT_MS = 15_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!isOAuthProvider(provider)) {
    return errorRedirect('Unknown OAuth provider');
  }

  const code = req.nextUrl.searchParams.get('code');
  const returnedState = req.nextUrl.searchParams.get('state');
  const errorParam = req.nextUrl.searchParams.get('error');

  if (errorParam) {
    const desc = req.nextUrl.searchParams.get('error_description') ?? errorParam;
    console.warn(`[oauth/${provider}] Provider returned error: ${desc}`);
    return errorRedirect(`OAuth error: ${desc}`);
  }

  if (!code || !returnedState) {
    return errorRedirect('Missing code or state in callback');
  }

  const cookieStore = await cookies();
  const cookiePrefix = `oauth_${provider}`;
  const storedState = cookieStore.get(`${cookiePrefix}_state`)?.value;
  const deviceId = cookieStore.get(`${cookiePrefix}_device_id`)?.value;
  const codeVerifier = cookieStore.get(`${cookiePrefix}_code_verifier`)?.value;

  cookieStore.delete(`${cookiePrefix}_state`);
  cookieStore.delete(`${cookiePrefix}_device_id`);
  cookieStore.delete(`${cookiePrefix}_code_verifier`);

  if (!storedState || storedState !== returnedState) {
    console.warn(`[oauth/${provider}] State mismatch — possible CSRF`);
    return errorRedirect('State parameter mismatch; please try connecting again');
  }

  if (!deviceId) {
    return errorRedirect('Session expired; please try connecting again');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorRedirect('Not authenticated');
  }

  // Load device including its existing connection_config so we can merge
  // the new tokens without erasing provider-specific fields (site_id, vehicle_id,
  // api_key, system_id, vin, region, etc.) that were set during device configuration.
  const { data: device } = await supabase
    .from('devices')
    .select('id, user_id, provider_type, name, connection_config')
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .single();

  if (!device) {
    return errorRedirect('Device not found');
  }

  // Verify device provider_type matches the OAuth provider in the URL.
  // Prevents a CSRF-style substitution where a start for provider A
  // completes against a device configured for provider B.
  if (device.provider_type !== provider) {
    console.warn(
      `[oauth/${provider}] provider mismatch: device ${deviceId} has provider_type "${device.provider_type}"`
    );
    return errorRedirect('Provider mismatch; please try connecting again');
  }

  // Decrypt the existing connection_config so we can merge token fields into it.
  const storedConfig = (device.connection_config ?? {}) as Record<string, unknown>;
  const existingConfig =
    typeof storedConfig.__encrypted === 'string' && storedConfig.__encrypted.length > 0
      ? decryptConnectionConfig(storedConfig)
      : storedConfig;

  const cfg = OAUTH_PROVIDERS[provider];
  const clientId = process.env[cfg.clientIdEnv] ?? '';
  const clientSecret = cfg.clientSecretEnv ? (process.env[cfg.clientSecretEnv] ?? '') : '';
  const redirectUri = buildRedirectUri(req, provider);

  let tokenResponse: Record<string, unknown>;
  try {
    tokenResponse = await exchangeCode({
      tokenUrl: cfg.tokenUrl,
      code,
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier: cfg.pkce ? codeVerifier : undefined,
      basicAuth: cfg.basicAuth,
    });
  } catch (err) {
    console.error(`[oauth/${provider}] Token exchange failed:`, err);
    return errorRedirect(`Token exchange failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  const accessToken = String(tokenResponse.access_token ?? '');
  const refreshToken = String(tokenResponse.refresh_token ?? '');
  const expiresIn = Number(tokenResponse.expires_in ?? 0);

  if (!accessToken) {
    return errorRedirect('Provider did not return an access_token');
  }

  const expiresAt = expiresIn > 0
    ? Math.floor(Date.now() / 1000) + expiresIn
    : undefined;

  // Merge new tokens into the existing connection_config.
  // This preserves provider-specific fields already set during device setup:
  //   Tesla:   vehicle_id, site_id, vin, region
  //   Enphase: api_key, system_id
  // Without this merge those fields would be erased on every reconnect,
  // making the device unusable immediately after a successful OAuth flow.
  const mergedConfig = buildConnectionConfig(provider, existingConfig, {
    accessToken,
    refreshToken,
    expiresAt,
    clientId,
    clientSecret,
  });

  const encrypted = encryptConnectionConfig(mergedConfig);

  const { error: updateError } = await supabase
    .from('devices')
    .update({ connection_config: encrypted })
    .eq('id', deviceId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error(`[oauth/${provider}] Failed to persist tokens:`, updateError);
    return errorRedirect('Failed to save connection tokens');
  }

  await recordAuditEvent({
    userId: user.id,
    action: 'oauth.connect',
    deviceId,
    actorIp: getClientIp(req),
    metadata: { provider, device_name: device.name },
  });

  return NextResponse.redirect(new URL(`${SETTINGS_URL}?connected=${provider}`, req.nextUrl.origin));
}

async function exchangeCode(opts: {
  tokenUrl: string;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier?: string;
  basicAuth: boolean;
}): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });

  if (!opts.basicAuth) {
    body.set('client_id', opts.clientId);
  }
  if (opts.codeVerifier) {
    body.set('code_verifier', opts.codeVerifier);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (opts.basicAuth && opts.clientId && opts.clientSecret) {
    const basic = Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(opts.tokenUrl, {
      method: 'POST',
      headers,
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

/**
 * Build the merged connection_config for persistence after a successful OAuth
 * token exchange. Starts from `existing` (the decrypted current config), then
 * overlays only the token fields. This preserves any provider-specific keys
 * already set during device configuration:
 *   Tesla:   vehicle_id, site_id, vin, region
 *   Enphase: api_key, system_id
 * Overwriting those fields would render the device unusable until the user
 * reconfigures it manually.
 */
function buildConnectionConfig(
  provider: string,
  existing: Record<string, unknown>,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: number;
    clientId: string;
    clientSecret: string;
  }
): Record<string, unknown> {
  // Start from the existing config, then overlay token fields.
  const merged: Record<string, unknown> = { ...existing };

  merged.access_token = tokens.accessToken;
  if (tokens.refreshToken) merged.refresh_token = tokens.refreshToken;
  if (tokens.expiresAt) merged.expires_at = tokens.expiresAt;

  // Persist OAuth app credentials alongside the tokens so the adapter can
  // use them when refreshing without needing global env vars.
  if (provider === 'enphase') {
    if (tokens.clientId) merged.client_id = tokens.clientId;
    if (tokens.clientSecret) merged.client_secret = tokens.clientSecret;
  }
  if (provider === 'tesla') {
    if (tokens.clientId) merged.client_id = tokens.clientId;
  }

  return merged;
}

function errorRedirect(message: string): NextResponse {
  const url = new URL(
    `${SETTINGS_URL}?oauth_error=${encodeURIComponent(message)}`,
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  );
  return NextResponse.redirect(url.toString());
}

function buildRedirectUri(req: NextRequest, provider: string): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return `${origin}/api/auth/oauth/${provider}/callback`;
}
