/**
 * Next.js instrumentation hook — runs once at server startup before any
 * request is served. Used to eagerly validate required environment variables
 * so misconfiguration is caught at boot time rather than on first use.
 *
 * See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateKeySetup } = await import('./lib/crypto/connection-config');
    validateKeySetup();
  }
}
