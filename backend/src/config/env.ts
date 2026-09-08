import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

// Load .env.test if in test environment, otherwise load default .env
if (process.env.NODE_ENV === 'test') {
  const possibleTestEnvPaths = [
    path.resolve(process.cwd(), '.env.test'),
    path.resolve(process.cwd(), 'backend', '.env.test'),
    path.resolve(process.cwd(), '..', '.env.test'),
  ];
  for (const envPath of possibleTestEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      break;
    }
  }
} else {
  dotenv.config();
}

const envSchema = z
  .object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    FRONTEND_URL: z.string().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
      .default('development-secret-key-32-chars-minimum-ticket-ai'),
    BETTER_AUTH_URL: z.string().default('http://localhost:5000'),
    TRUSTED_ORIGINS: z
      .string()
      .min(1, 'TRUSTED_ORIGINS is required in .env')
      .transform((val) =>
        val
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      ),
    GEMINI_API_KEY: z.string().optional().default(''),
    GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    EMAIL_PROVIDER: z.enum(['mock', 'sendgrid', 'mailgun']).default('mock'),
    SENDGRID_API_KEY: z.string().optional().default(''),
    MAILGUN_API_KEY: z.string().optional().default(''),
    MAILGUN_DOMAIN: z.string().optional().default(''),
    SUPPORT_EMAIL: z.string().default('support@ticketai.local'),
    ADMIN_EMAIL: z.string().email().default('admin@ticketai.local'),
    ADMIN_PASSWORD: z.string().min(8).default('AdminPassword123!'),
    ADMIN_NAME: z.string().default('System Administrator'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (
        !process.env.BETTER_AUTH_SECRET ||
        data.BETTER_AUTH_SECRET.includes('development-secret') ||
        data.BETTER_AUTH_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'BETTER_AUTH_SECRET must be explicitly set to a strong unique secret (min 32 chars) in production',
          path: ['BETTER_AUTH_SECRET'],
        });
      }
      if (!process.env.ADMIN_PASSWORD || data.ADMIN_PASSWORD === 'AdminPassword123!') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ADMIN_PASSWORD cannot use default password in production',
          path: ['ADMIN_PASSWORD'],
        });
      }
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
