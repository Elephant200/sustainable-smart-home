'use client';

import { useEffect } from 'react';

/**
 * Initializes client-side error reporting in the browser.
 * Wires window.onerror + unhandledrejection to NEXT_PUBLIC_SENTRY_DSN when set.
 * This is a no-op when the env var is absent.
 *
 * Mount once in the root layout — it has no visible output.
 */
export function ClientReporterInit() {
  useEffect(() => {
    import('@/lib/reporter').then(({ initClientReporter }) => {
      initClientReporter();
    });
  }, []);
  return null;
}
