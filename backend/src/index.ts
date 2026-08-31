import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { auth } from './lib/auth.js';
import { requireAuth, requireRole, AuthenticatedRequest } from './middleware/auth.middleware.js';

const app = express();

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
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
});

// Protected Route: Returns current user & session from Better Auth
app.get('/api/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    user: req.user,
    session: req.session,
  });
});

// Protected Admin Route: Requires ADMIN role
app.get('/api/admin/ping', requireAuth, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  res.json({
    message: 'Admin authorization verified',
    user: req.user,
  });
});

const server = app.listen(env.PORT, () => {
  console.log(`🚀 TicketAI Backend server running on http://localhost:${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
});

export default app;
