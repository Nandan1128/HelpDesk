import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  GEMINI_API_KEY: z.string().optional().default(''),
  EMAIL_PROVIDER: z.enum(['mock', 'sendgrid', 'mailgun']).default('mock'),
  SENDGRID_API_KEY: z.string().optional().default(''),
  MAILGUN_API_KEY: z.string().optional().default(''),
  MAILGUN_DOMAIN: z.string().optional().default(''),
  SUPPORT_EMAIL: z.string().default('support@ticketai.local'),
  ADMIN_EMAIL: z.string().email().default('admin@ticketai.local'),
  ADMIN_PASSWORD: z.string().min(8).default('AdminPassword123!'),
  ADMIN_NAME: z.string().default('System Administrator'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
