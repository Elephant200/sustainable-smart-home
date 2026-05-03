/**
 * OAuth provider configuration for the /api/auth/oauth/* handshake routes.
 *
 * Supported providers:
 *   - tesla:   OAuth2 PKCE (RFC 7636). Requires TESLA_CLIENT_ID env var.
 *   - enphase: OAuth2 authorization-code with HTTP Basic on the token endpoint.
 *              Requires ENPHASE_CLIENT_ID + ENPHASE_CLIENT_SECRET env vars.
 *
 * To add a new OAuth provider:
 *   1. Add its key to the OAuthProvider union type.
 *   2. Add an entry in OAUTH_PROVIDERS with authMethod, authUrl, tokenUrl,
 *      scopes, and whether it needs PKCE.
 *   3. If credentials live in env vars add them to the envClientId /
 *      envClientSecret getters.
 *   4. Add a handler in the callback route for how to extract fields from the
 *      token response and which connection_config keys to persist.
 */

export type OAuthProvider = 'tesla' | 'enphase';

export interface OAuthProviderConfig {
  displayName: string;
  /** Authorization URL users are redirected to. */
  authUrl: string;
  /** Token URL for code exchange and refresh. */
  tokenUrl: string;
  /** Space-separated scope string. */
  scopes: string;
  /** Whether to use PKCE (required by Tesla). */
  pkce: boolean;
  /** Whether the token endpoint uses HTTP Basic auth (client_id:secret). */
  basicAuth: boolean;
  /** Env var name for the OAuth client ID. */
  clientIdEnv: string;
  /** Env var name for the OAuth client secret (empty string if not needed). */
  clientSecretEnv: string;
}

export const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthProviderConfig> = {
  tesla: {
    displayName: 'Tesla',
    authUrl: 'https://auth.tesla.com/oauth2/v3/authorize',
    tokenUrl: 'https://auth.tesla.com/oauth2/v3/token',
    scopes: 'openid offline_access energy_device_data vehicle_device_data',
    pkce: true,
    basicAuth: false,
    clientIdEnv: 'TESLA_CLIENT_ID',
    clientSecretEnv: '',
  },
  enphase: {
    displayName: 'Enphase',
    authUrl: 'https://api.enphaseenergy.com/oauth/authorize',
    tokenUrl: 'https://api.enphaseenergy.com/oauth/token',
    scopes: '',
    pkce: false,
    basicAuth: true,
    clientIdEnv: 'ENPHASE_CLIENT_ID',
    clientSecretEnv: 'ENPHASE_CLIENT_SECRET',
  },
};

export function isOAuthProvider(provider: string): provider is OAuthProvider {
  return provider in OAUTH_PROVIDERS;
}

/**
 * Generate a PKCE code_verifier (43–128 URL-safe chars) and code_challenge
 * (base64url-encoded SHA-256 hash of verifier, per RFC 7636 §4.2).
 */
export async function generatePkce(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array);

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier)
  );
  const codeChallenge = base64UrlEncode(new Uint8Array(hashBuffer));
  return { codeVerifier, codeChallenge };
}

function base64UrlEncode(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a cryptographically random state parameter for CSRF protection.
 * Stored in a short-lived cookie by the /start route and verified by the
 * /callback route before exchanging the authorization code.
 */
export function generateState(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}
