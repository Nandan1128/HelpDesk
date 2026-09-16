import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Respect test environment when loading env variables (without overriding existing environment variables)
if (process.env.NODE_ENV === 'test') {
  const possibleTestEnvPaths = [
    path.resolve(process.cwd(), '.env.test'),
    path.resolve(process.cwd(), 'backend', '.env.test'),
    path.resolve(process.cwd(), '..', '.env.test'),
  ];
  for (const envPath of possibleTestEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
      break;
    }
  }
} else {
  const possibleEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend', '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ];
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
      break;
    }
  }
}

const dsn = process.env.SENTRY_DSN;

if (dsn && process.env.NODE_ENV !== 'test') {
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) : 1.0,
      sendDefaultPii: false,
      beforeSend(event) {
        // Strip sensitive credentials/tokens from logged error events
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });

    console.log(`🛡️ [Sentry] Backend instrumentation initialized (${process.env.NODE_ENV || 'development'})`);
  } catch (error) {
    console.error('❌ [Sentry] Backend initialization failed:', error);
  }
}

export { Sentry };
