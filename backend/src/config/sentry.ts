import { Request, Response } from 'express';
import { Sentry } from '../instrument.js';
import { env } from './env.js';

/**
 * Helper to capture exceptions with custom context (useful for background workers and services)
 */
export function captureServiceError(
  error: unknown,
  context?: { service?: string; action?: string; extra?: Record<string, unknown> }
): void {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (context?.service) scope.setTag('service', context.service);
    if (context?.action) scope.setTag('action', context.action);
    if (context?.extra) scope.setExtras(context.extra);

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(typeof error === 'string' ? error : JSON.stringify(error), 'error');
    }
  });
}

/**
 * Helper to capture route-level exceptions explicitly from Express route catch blocks
 */
export function captureRouteError(
  error: unknown,
  req: Request,
  context?: { action?: string; extra?: Record<string, unknown> }
): void {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    scope.setTag('route', req.route?.path || req.path);
    scope.setTag('method', req.method);
    scope.setTag('url', req.originalUrl || req.url);
    if (context?.action) scope.setTag('action', context.action);
    
    scope.setExtra('query', req.query);
    scope.setExtra('params', req.params);
    if (context?.extra) scope.setExtras(context.extra);

    const user = (req as any).user;
    if (user) {
      scope.setUser({
        id: user.id,
        email: user.email,
        role: user.role,
      });
    }

    if (req.body && typeof req.body === 'object') {
      const sanitizedBody = { ...req.body };
      delete sanitizedBody.password;
      delete sanitizedBody.apiKey;
      delete sanitizedBody.secret;
      scope.setExtra('body', sanitizedBody);
    }

    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(typeof error === 'string' ? error : JSON.stringify(error), 'error');
    }
  });
}

export { Sentry };
