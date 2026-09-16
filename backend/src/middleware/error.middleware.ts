import { Request, Response, NextFunction, ErrorRequestHandler, RequestHandler } from 'express';
import { Sentry } from '../config/sentry.js';
import { env } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Middleware that intercepts any 5xx HTTP responses sent by route handlers
 * and ensures they are reported to Sentry even if the route caught the exception internally.
 */
export const sentryResponseErrorCaptureMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = 200;

  res.status = function (code: number) {
    statusCode = code;
    return originalStatus(code);
  };

  res.json = function (body: any) {
    if (statusCode >= 500 && process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setTag('route', req.route?.path || req.path);
        scope.setTag('method', req.method);
        scope.setTag('url', req.originalUrl || req.url);
        scope.setTag('status_code', String(statusCode));
        scope.setExtra('query', req.query);
        scope.setExtra('params', req.params);
        scope.setExtra('response', body);

        const user = (req as any).user;
        if (user) {
          scope.setUser({ id: user.id, email: user.email, role: user.role });
        }

        const message =
          (typeof body === 'object' && body !== null && (body.error || body.message)) ||
          `Backend HTTP ${statusCode} on ${req.method} ${req.originalUrl || req.path}`;

        Sentry.captureMessage(String(message), 'error');
      });
    }
    return originalJson(body);
  };

  next();
};

/**
 * Global Express Error Handling Middleware.
 * Captures unexpected server exceptions with Sentry and returns a sanitized JSON error payload.
 */
export const errorHandler: ErrorRequestHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  // Log error to server console
  console.error(`[Error] [${req.method} ${req.originalUrl}] [${statusCode}]:`, err);

  // Capture 5xx internal server errors to Sentry
  if (statusCode >= 500 && process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('route', req.route?.path || req.path);
      scope.setTag('method', req.method);
      scope.setTag('url', req.originalUrl || req.url);
      scope.setTag('status_code', String(statusCode));
      scope.setExtra('query', req.query);
      scope.setExtra('params', req.params);

      const user = (req as any).user;
      if (user) {
        scope.setUser({ id: user.id, email: user.email, role: user.role });
      }

      if (req.body && typeof req.body === 'object') {
        const sanitizedBody = { ...req.body };
        delete sanitizedBody.password;
        delete sanitizedBody.apiKey;
        delete sanitizedBody.secret;
        scope.setExtra('body', sanitizedBody);
      }
      Sentry.captureException(err);
    });
  }

  // Respond with sanitized error response
  res.status(statusCode).json({
    error:
      statusCode === 500 && env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'An unexpected error occurred',
    code: err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    ...(err.details ? { details: err.details } : {}),
  });
};
