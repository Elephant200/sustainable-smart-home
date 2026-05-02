# Security Policy

## Threat Model

Sustainable Smart Home stores sensitive third-party credentials (OAuth tokens, API keys) for energy hardware providers such as Tesla, Enphase, SolarEdge, Home Assistant, and Emporia. Our primary threats are:

1. **Database compromise** — An attacker who gains read access to the Supabase `devices` table must not be able to recover provider credentials in plaintext.
2. **Injection / unexpected input** — API routes must reject malformed or oversized payloads before they reach business logic.
3. **Abuse / brute-force** — Rate limiting protects credential-writing endpoints and read endpoints from enumeration.
4. **Clickjacking / MIME sniffing / XSS** — HTTP security headers harden the browser-side attack surface.
5. **SSRF (Home Assistant)** — The HA adapter blocks RFC1918 and metadata service IPs to prevent server-side request forgery via a malicious base_url.

---

## Credential Encryption

Device credentials are encrypted with **AES-256-GCM** before being written to `devices.connection_config`.

**Current format**: `v1:iv_hex:auth_tag_hex:ciphertext_hex`

The `v1` prefix identifies which key was used, enabling future key rotation without breaking existing rows.

### Key configuration

| Environment variable | Purpose |
|---|---|
| `CONNECTION_CONFIG_SECRET` | Active 256-bit key, encoded as 64 hex characters. Maps to key version `v1`. |
| `CONNECTION_CONFIG_SECRET_V2` | Future key used during rotation. Maps to version `v2`. |

Generate a key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Missing key behavior**: If `CONNECTION_CONFIG_SECRET` is not set, the server **fails to start** in all environments except `NODE_ENV=test`. There is no silent fallback in production or development.

---

## Key Rotation Procedure

1. Generate a new 64-character hex key.
2. Set `CONNECTION_CONFIG_SECRET_V2` in your environment (keep the existing `CONNECTION_CONFIG_SECRET` in place — both keys must be loaded simultaneously during migration).
3. Update `lib/crypto/connection-config.ts` so `CURRENT_KEY_VERSION = 'v2'` and `'v2'` maps to `CONNECTION_CONFIG_SECRET_V2`.
4. Run the re-encryption migration:
   ```bash
   npm run migrate:reencrypt
   ```
   The script reads each row, decrypts with the old key (auto-detected by version prefix), re-encrypts with the current key (v2), and writes it back. It is idempotent — rows already on v2 are skipped.
5. Verify the migration output shows `failed=0`.
6. Remove `CONNECTION_CONFIG_SECRET` from your environment and rename `CONNECTION_CONFIG_SECRET_V2` → `CONNECTION_CONFIG_SECRET`.
7. Remove the old key entry from the key map in `lib/crypto/connection-config.ts`.

---

## Running the Re-encryption Migration

```bash
# Set environment variables first
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export CONNECTION_CONFIG_SECRET=<old key>
export CONNECTION_CONFIG_SECRET_V2=<new key>  # optional during first-time migration

npm run migrate:reencrypt
```

The script:
- Fetches all `devices` rows with a non-empty `connection_config`.
- Skips rows already in the current key version format.
- Decrypts each row, re-encrypts with the current key, and updates the row.
- Exits non-zero if any row fails.

---

## Rate Limits

| Endpoint class | Default limit | Window | Env vars |
|---|---|---|---|
| Read endpoints (`GET`) | 60 req | 60 s | `RATE_LIMIT_READ_MAX`, `RATE_LIMIT_READ_WINDOW_MS` |
| Write endpoints (`POST`, `PUT`, `DELETE` on credential routes) | 10 req | 60 s | `RATE_LIMIT_WRITE_MAX`, `RATE_LIMIT_WRITE_WINDOW_MS` |

Exceeded requests receive HTTP 429 with a `Retry-After` header (seconds).

Rate limit keys are scoped to `user_id + IP`. The in-memory store resets on server restart; for multi-instance deployments, swap the store for Redis or Upstash by updating `lib/api/rate-limit.ts`.

---

## Audit Logs

Security-relevant events are recorded in the `audit_logs` Supabase table:

| Action | Trigger |
|---|---|
| `device.create` | New device added |
| `device.update` | Device settings changed |
| `device.delete` | Device deactivated |
| `credential.write` | Provider credentials saved or updated |
| `oauth.connect` | OAuth provider connected |
| `oauth.disconnect` | OAuth provider disconnected |
| `location.update` | Home location updated |

`metadata` fields never contain plaintext secrets. Users can view their own audit log on the Settings page ("Recent Activity") and via `GET /api/audit-log`. Row Level Security restricts reads to the owning user.

---

## Security Headers

All responses include:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Content-Security-Policy` | Allowlists self + Supabase + Google Fonts; denies frames |

Headers are configured in `next.config.ts`.

---

## Development-only Routes

`GET /api/populate-database` is blocked in `NODE_ENV=production` with HTTP 403. It is available in development and test environments for seeding demo data.

---

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately by emailing the project maintainers. Do not open a public GitHub issue. We aim to respond within 72 hours and issue a fix within 14 days for critical issues.
