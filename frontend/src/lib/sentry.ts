import * as Sentry from '@sentry/react';

let isSentryInitialized = false;

/**
 * Initializes Sentry in the React browser environment.
 * Gracefully no-ops if VITE_SENTRY_DSN is not configured.
 */
export function initSentry(): void {
  if (isSentryInitialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    // Sentry is optional for local development
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || 'development',
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      // Performance monitoring sample rate (10% in production, 100% otherwise)
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      // Session Replay sample rate
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });

    isSentryInitialized = true;
    console.log(`🛡️ [Sentry] Frontend monitoring initialized (${import.meta.env.MODE})`);
  } catch (error) {
    console.error('❌ [Sentry] Frontend initialization error:', error);
  }
}

export { Sentry };
