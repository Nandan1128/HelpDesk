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
import { Role } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { QueueService } from './services/queue.service.js';
import { ImapListenerService } from './services/imap-listener.service.js';

const app = express();

// Instant Healthcheck for Railway / load balancer probes (bypasses rate limiting & middleware)
app.get(['/api/health', '/health'], (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

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

// Rate Limiters (Enabled only in production for API routes)
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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        env.TRUSTED_ORIGINS.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// Better Auth Route Handler (handles sign-up, sign-in, sign-out, session, etc.)
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  // Synchronize or create admin account credentials from environment variables
  (async () => {
    try {
      const adminEmail = (env.ADMIN_EMAIL || 'admin@ticketai.local').toLowerCase().trim();
      const adminPassword = env.ADMIN_PASSWORD;
      const adminName = env.ADMIN_NAME || 'System Administrator';

      if (adminEmail && adminPassword) {
        const hashedPassword = await hashPassword(adminPassword);
        
        let admin = await prisma.user.findFirst({
          where: {
            OR: [
              { email: adminEmail },
              { role: Role.ADMIN },
            ],
          },
        });

        if (!admin) {
          admin = await prisma.user.create({
            data: {
              email: adminEmail,
              name: adminName,
              role: Role.ADMIN,
              isActive: true,
              emailVerified: true,
            },
          });
          await prisma.account.create({
            data: {
              accountId: admin.id,
              userId: admin.id,
              providerId: 'credential',
              issuer: 'local:credential',
              password: hashedPassword,
            },
          });
          console.log(`✅ Admin account created: ${adminEmail}`);
        } else {
          // Update existing admin account to match current environment variables
          await prisma.user.update({
            where: { id: admin.id },
            data: {
              email: adminEmail,
              name: adminName,
              isActive: true,
              role: Role.ADMIN,
            },
          });

          const account = await prisma.account.findFirst({
            where: { userId: admin.id, providerId: 'credential' },
          });

          if (account) {
            await prisma.account.update({
              where: { id: account.id },
              data: { password: hashedPassword },
            });
          } else {
            await prisma.account.create({
              data: {
                accountId: admin.id,
                userId: admin.id,
                providerId: 'credential',
                issuer: 'local:credential',
                password: hashedPassword,
              },
            });
          }
          console.log(`🔑 Admin account credentials synchronized for: ${adminEmail}`);
        }
      }
    } catch (err) {
      console.warn('Admin credentials sync warning (non-fatal):', err);
    }
  })();

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

