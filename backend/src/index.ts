import './instrument.js';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { toNodeHandler } from 'better-auth/node';
import { env } from './config/env.js';
import { Sentry, captureServiceError } from './config/sentry.js';
import { prisma } from './db/prisma.js';
import { auth } from './lib/auth.js';
import { requireAuth, requireRole, AuthenticatedRequest } from './middleware/auth.middleware.js';
import { errorHandler, sentryResponseErrorCaptureMiddleware } from './middleware/error.middleware.js';
import { userRoutes, emailRoutes, ticketRoutes } from './routes/index.js';
import { QueueService } from './services/queue.service.js';
import { ImapListenerService } from './services/imap-listener.service.js';

const app = express();

// Sentry response status monitor (captures any 5xx response automatically)
app.use(sentryResponseErrorCaptureMiddleware);


// Trust reverse proxy in production (for accurate client IP resolution & secure cookies)
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// HTTP Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Rate Limiters (Enabled only in production)
if (env.NODE_ENV === 'production') {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', apiLimiter);
}

// Dedicated Healthcheck Rate Limiter in production to prevent DB connection exhaustion
const healthMiddlewares =
  env.NODE_ENV === 'production'
    ? [
      rateLimit({
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 60, // 60 requests per minute
        standardHeaders: true,
        legacyHeaders: false,
      }),
    ]
    : [];

app.use(
  cors({
    origin: env.TRUSTED_ORIGINS,
    credentials: true,
  })
);

// Better Auth Route Handler (handles sign-up, sign-in, sign-out, session, etc.)
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic Healthcheck & DB ping
app.get(['/api/health', '/health'], ...healthMiddlewares, async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (error) {
    console.error('Health check database error:', error);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Database connectivity error',
    });
  }
});

// Protected Route: Returns current user & session from Better Auth
app.get('/api/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Omit raw token to prevent client-side script leakage of HTTP-only session tokens
  const { token, ...safeSession } = req.session as Record<string, unknown>;

  res.json({
    user: req.user,
    session: safeSession,
  });
});

// Protected Admin Route: Requires ADMIN role
app.get('/api/admin/ping', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'Admin authorization verified',
    user: req.user,
  });
});

// User Management Routes (Protected & Admin Only)
app.use('/api/users', userRoutes);

// Inbound Email Ingestion Routes
app.use('/api/emails', emailRoutes);
app.use('/api/webhooks/email', emailRoutes);

// Ticket Management Routes
app.use('/api/tickets', ticketRoutes);

// Sentry Debug Test Route (Enabled in non-production or explicitly for testing)
if (env.NODE_ENV !== 'production') {
  app.get('/api/debug/sentry-test', (_req, _res) => {
    throw new Error('TicketAI Sentry Backend Test Error - Everything is working properly!');
  });
}

// Static Frontend Serving (Enabled when built frontend dist is present)
const possibleFrontendPaths = [
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), 'dist/public'),
  path.resolve(process.cwd(), 'public'),
];

const frontendDistPath = possibleFrontendPaths.find((dir) => fs.existsSync(dir));

if (frontendDistPath) {
  console.log(`📦 Serving static frontend bundle from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));

  // Client-side SPA routing fallback for non-API GET requests
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 404 Route Handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Global Error Handler Middleware (captures uncaught exceptions with Sentry)
app.use(errorHandler);

const server = app.listen(env.PORT, '0.0.0.0', async () => {
  console.log(`🚀 TicketAI Backend server running on http://0.0.0.0:${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
  try {
    await QueueService.start();
  } catch (error) {
    console.error('Failed to initialize pg-boss queue service:', error);
    captureServiceError(error, { service: 'pg-boss', action: 'startup' });
  }

  // Start IMAP background email polling if enabled
  try {
    ImapListenerService.start();
  } catch (error) {
    console.error('Failed to start IMAP email listener service:', error);
    captureServiceError(error, { service: 'imap-listener', action: 'startup' });
  }
});

// Process-level unhandled errors capture
process.on('unhandledRejection', (reason: unknown) => {
  console.error('💥 Unhandled Promise Rejection:', reason);
  captureServiceError(reason, { service: 'process', action: 'unhandledRejection' });
});

process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception:', error);
  captureServiceError(error, { service: 'process', action: 'uncaughtException' });
});

// Graceful process shutdown
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  try {
    ImapListenerService.stop();
    await QueueService.stop();
    await prisma.$disconnect();
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    captureServiceError(error, { service: 'process', action: 'shutdown' });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;

