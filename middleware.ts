import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function generateRequestId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // Format as UUID v4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();

  // React dev mode requires 'unsafe-eval' for fast refresh / error overlay
  // callstack reconstruction. Production builds never use eval, so we gate
  // the directive on NODE_ENV to keep the production CSP strict.
  const isDev = process.env.NODE_ENV !== "production";
  const evalDirective = isDev ? " 'unsafe-eval'" : "";

  const csp = [
    "default-src 'self'",
    // nonce-{nonce}: whitelists scripts carrying the per-request nonce.
    // 'unsafe-inline' is kept as a CSP Level 2 fallback only — CSP Level 3
    // browsers ignore it when a nonce is present (per spec §8.2).
    // 'strict-dynamic' causes CSP3 browsers to additionally ignore
    // 'unsafe-inline' and 'self', trusting only nonced scripts and the
    // scripts they load dynamically (the recommended Next.js approach).
    `script-src 'nonce-${nonce}' 'unsafe-inline' 'strict-dynamic'${evalDirective}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  // Inject nonce and request-id into request headers so server components
  // can read them via next/headers headers().
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);

  // Run the Supabase session middleware with the original request so it can
  // read/write auth cookies correctly.
  const supabaseResponse = await updateSession(request);

  // For redirects (auth-required routes), attach CSP and pass through.
  if (supabaseResponse.status !== 200) {
    supabaseResponse.headers.set("Content-Security-Policy", csp);
    supabaseResponse.headers.set("X-Request-Id", requestId);
    return supabaseResponse;
  }

  // Build a response that forwards the modified request headers (with x-nonce
  // and x-request-id) to server components.
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Copy Supabase-managed cookies (token refresh, session, etc.) to the
  // new response so the user's session is preserved.
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Copy other response headers from the Supabase middleware pass (excluding
  // set-cookie, which is already handled above to avoid duplication).
  supabaseResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      response.headers.set(key, value);
    }
  });

  // Apply the nonce-bearing CSP header and request-id.
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Request-Id", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
