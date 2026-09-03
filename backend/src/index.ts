import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { toNodeHandler } from 'better-auth/node';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { auth } from './lib/auth.js';
import { requireAuth, requireRole, AuthenticatedRequest } from './middleware/auth.middleware.js';
import userRoutes from './routes/user.routes.js';
import emailRoutes from './routes/email.routes.js';

const app = express();

// Trust reverse proxy in production (for accurate client IP resolution & secure cookies)
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// HTTP Security Headers
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
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
app.get('/api/health', ...healthMiddlewares, async (req, res) => {
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

const server = app.listen(env.PORT, () => {
  console.log(`🚀 TicketAI Backend server running on http://localhost:${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
});

export default app;
