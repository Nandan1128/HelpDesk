import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

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

const server = app.listen(env.PORT, () => {
  console.log(`🚀 TicketAI Backend server running on http://localhost:${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
});

export default app;
