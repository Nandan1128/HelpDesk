import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  databaseHooks: {
    user: {
      delete: {
        before: async (user) => {
          await prisma.ticket.updateMany({
            where: { assignedToId: user.id },
            data: { assignedToId: null },
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true, deletedAt: true },
          });

          if (!user || user.deletedAt !== null || user.isActive === false) {
            throw new APIError('UNAUTHORIZED', {
              message: 'This account has been deactivated or deleted.',
            });
          }
        },
      },
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.TRUSTED_ORIGINS,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'AGENT',
        required: false,
      },
      isActive: {
        type: 'boolean',
        defaultValue: true,
        required: false,
      },
      deletedAt: {
        type: 'date',
        required: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: false,
    },
  },
  rateLimit: {
    enabled: env.NODE_ENV === 'production',
    window: 10,
    max: 100,
    customRules: {
      '/sign-in/email': {
        window: 60,
        max: 5,
      },
    },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
