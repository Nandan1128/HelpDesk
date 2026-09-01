import { PrismaClient, Role, TicketStatus, TicketCategory, Priority, SenderType } from '../../backend/node_modules/@prisma/client/index.js';
import { hashPassword } from 'better-auth/crypto';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.test
const envPath = fs.existsSync(path.resolve(process.cwd(), '.env.test'))
  ? path.resolve(process.cwd(), '.env.test')
  : path.resolve(process.cwd(), 'backend', '.env.test');

dotenv.config({ path: envPath, override: true });

// Shared test Prisma instance
let testPrisma: PrismaClient | null = null;

export function getTestPrismaClient(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:Npg%402003@localhost:5432/helpdesk_test?schema=public',
        },
      },
    });
  }
  return testPrisma;
}

export interface TestUserData {
  email: string;
  password: string;
  name: string;
  role: Role;
  isActive?: boolean;
}

export const TEST_USERS: Record<'admin' | 'agent1' | 'agent2', TestUserData> = {
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@ticketai.local',
    password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
    name: process.env.ADMIN_NAME || 'System Administrator',
    role: Role.ADMIN,
  },
  agent1: {
    email: 'sarah.agent@ticketai.local',
    password: 'AgentPassword123!',
    name: 'Sarah Connor',
    role: Role.AGENT,
  },
  agent2: {
    email: 'alex.agent@ticketai.local',
    password: 'AgentPassword123!',
    name: 'Alex Rivera',
    role: Role.AGENT,
  },
};

/**
 * Clean all data from test database tables
 */
export async function cleanDatabase(prisma: PrismaClient = getTestPrismaClient()) {
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.knowledgeBaseArticle.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Seed baseline test users, tickets, and knowledge base articles
 */
export async function seedTestDatabase(prisma: PrismaClient = getTestPrismaClient()) {
  await cleanDatabase(prisma);

  // Helper to create user with credentials
  async function createTestUser(user: TestUserData) {
    const hashedPassword = await hashPassword(user.password);
    const createdUser = await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive ?? true,
        emailVerified: true,
      },
    });

    await prisma.account.create({
      data: {
        accountId: createdUser.id,
        userId: createdUser.id,
        providerId: 'credential',
        issuer: 'local:credential',
        password: hashedPassword,
      },
    });

    return createdUser;
  }

  const admin = await createTestUser(TEST_USERS.admin);
  const agent1 = await createTestUser(TEST_USERS.agent1);
  const agent2 = await createTestUser(TEST_USERS.agent2);

  // Seed Knowledge Base Articles
  await prisma.knowledgeBaseArticle.createMany({
    data: [
      {
        title: 'Refund & Cancellation Policy',
        category: TicketCategory.REFUND_REQUEST,
        content: 'Customers can request a full refund within 30 days of purchase.',
      },
      {
        title: 'Troubleshooting Login & 2FA',
        category: TicketCategory.TECHNICAL_QUESTION,
        content: 'Use the 16-character backup code if authenticator app is lost.',
      },
      {
        title: 'Billing & Invoicing FAQs',
        category: TicketCategory.GENERAL_QUESTION,
        content: 'Invoices are generated on the 1st of every month.',
      },
    ],
  });

  // Seed Sample Ticket
  await prisma.ticket.create({
    data: {
      subject: 'Sample E2E Test Ticket',
      category: TicketCategory.GENERAL_QUESTION,
      status: TicketStatus.OPEN,
      priority: Priority.MEDIUM,
      customerEmail: 'customer@example.com',
      customerName: 'Test Customer',
      assignedToId: agent1.id,
      messages: {
        create: [
          {
            senderType: SenderType.CUSTOMER,
            senderEmail: 'customer@example.com',
            senderName: 'Test Customer',
            body: 'This is a test message in the seeded test database.',
          },
        ],
      },
    },
  });

  return { admin, agent1, agent2 };
}

/**
 * Disconnect Prisma test client
 */
export async function disconnectTestDatabase() {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}
