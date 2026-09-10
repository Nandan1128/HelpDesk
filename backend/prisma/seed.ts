import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaClient, Role, TicketStatus, TicketCategory, Priority, SenderType } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import { REAL_LIFE_TICKETS } from './ticket-seed-data.js';

if (process.env.NODE_ENV === 'test') {
  const possibleTestEnvPaths = [
    path.resolve(process.cwd(), '.env.test'),
    path.resolve(process.cwd(), 'backend', '.env.test'),
    path.resolve(process.cwd(), '..', '.env.test'),
  ];
  for (const envPath of possibleTestEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      break;
    }
  }
}
dotenv.config();

const prisma = new PrismaClient();

async function createUserWithPassword(data: {
  email: string;
  name: string;
  password: string;
  role: Role;
  isActive?: boolean;
}) {
  const hashedPassword = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      role: data.role,
      isActive: data.isActive ?? true,
      emailVerified: true,
    },
  });

  await prisma.account.create({
    data: {
      accountId: user.id,
      userId: user.id,
      providerId: 'credential',
      issuer: 'local:credential',
      password: hashedPassword,
    },
  });

  return user;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_SEED) {
    console.error('🛑 FATAL: Database seeding is disabled in production to prevent accidental data loss.');
    console.error('To force seed, set ALLOW_PRODUCTION_SEED=true in your environment.');
    process.exit(1);
  }

  console.log('🌱 Starting database seeding...');

  // 1. Clean existing data
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.knowledgeBaseArticle.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Admin Users
  const adminExample = await createUserWithPassword({
    email: 'admin@example.com',
    name: 'Admin',
    password: 'Password@123',
    role: Role.ADMIN,
    isActive: true,
  });

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ticketai.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';

  const admin = await createUserWithPassword({
    email: adminEmail,
    name: adminName,
    password: adminPassword,
    role: Role.ADMIN,
    isActive: true,
  });
  console.log(`✅ Created Admin Users: ${adminExample.email}, ${admin.email}`);

  // 3. Seed Sample Support Agents
  const agentExample = await createUserWithPassword({
    email: 'agent1@example.com',
    name: 'Agent One',
    password: 'Password@123',
    role: Role.AGENT,
    isActive: true,
  });

  const agent1 = await createUserWithPassword({
    email: 'sarah.agent@ticketai.local',
    name: 'Sarah Connor',
    password: 'AgentPassword123!',
    role: Role.AGENT,
    isActive: true,
  });

  const agent2 = await createUserWithPassword({
    email: 'alex.agent@ticketai.local',
    name: 'Alex Rivera',
    password: 'AgentPassword123!',
    role: Role.AGENT,
    isActive: false,
  });

  const aiEmail = process.env.AI_AGENT_EMAIL || 'ai@ticketai.local';
  const aiAgent = await prisma.user.create({
    data: {
      email: aiEmail,
      name: 'AI',
      role: Role.AGENT,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log(`✅ Created Support Agents: ${agentExample.email}, ${agent1.email}, ${agent2.email} (inactive), ${aiAgent.email} (AI - system agent, no password)`);

  // 4. Seed Knowledge Base Articles
  const kbRefund = await prisma.knowledgeBaseArticle.create({
    data: {
      title: 'Refund & Cancellation Policy',
      category: TicketCategory.REFUND_REQUEST,
      content: `Our refund policy allows customers to request a full refund within 30 days of purchase for annual and monthly software subscriptions.
- If requested within 30 days, refunds are processed within 3-5 business days back to the original payment method.
- Custom enterprise contracts and processed hardware setups are non-refundable after activation.
- To request a refund, customers must provide their invoice number or registered email address.`,
    },
  });

  const kbTechnical = await prisma.knowledgeBaseArticle.create({
    data: {
      title: 'Troubleshooting Login, SSO & Two-Factor Authentication (2FA)',
      category: TicketCategory.TECHNICAL_QUESTION,
      content: `If you are experiencing issues logging into your account:
1. Ensure your browser cache and cookies are cleared, or try an Incognito/Private window.
2. If 2FA fails, use your 16-character backup recovery code provided during setup.
3. For SSO Google/Microsoft login errors, verify your workspace administrator has authorized the TicketAI integration in your corporate identity provider.
4. Password reset links expire after 15 minutes for security purposes.`,
    },
  });

  const kbGeneral = await prisma.knowledgeBaseArticle.create({
    data: {
      title: 'Billing Cycles, Invoicing & Plan Upgrades',
      category: TicketCategory.GENERAL_QUESTION,
      content: `Billing details and FAQs:
- Invoices are automatically generated on the 1st of each calendar month and emailed to the account owner.
- You can update your credit card details or billing address under Settings > Billing in your customer portal.
- Plan upgrades take effect immediately with prorated billing applied to your next monthly statement.`,
    },
  });
  console.log(`✅ Seeded ${3} Knowledge Base Articles`);

  // 5. Seed 100 Real-Life Diverse Tickets & Messages
  console.log(`🌱 Seeding ${REAL_LIFE_TICKETS.length} diverse real-life support tickets...`);
  const agents = [agentExample, agent1];
  const now = Date.now();

  for (let i = 0; i < REAL_LIFE_TICKETS.length; i++) {
    const seed = REAL_LIFE_TICKETS[i];
    // Calculate staggered createdAt from daysAgo, plus a few minutes jitter based on index
    const isAiAutoResolved =
      (seed.aiSummary?.includes('Auto-resolved') ?? false) ||
      seed.messages.some((m) => m.senderType === SenderType.SYSTEM);
    const assignedAgent = isAiAutoResolved
      ? aiAgent
      : seed.assignedAgentIndex !== null
      ? agents[seed.assignedAgentIndex]
      : null;

    const messagesCreate = seed.messages.map((m, msgIdx) => {
      const isAgent = m.senderType === SenderType.AGENT;
      const isSystem = m.senderType === SenderType.SYSTEM;
      const senderEmail = isSystem
        ? (process.env.SUPPORT_EMAIL || 'support@ticketai.local')
        : isAgent
        ? (assignedAgent?.email || agent1.email)
        : seed.customerEmail;
      const senderName = isSystem
        ? 'TicketAI Support'
        : isAgent
        ? (assignedAgent?.name || agent1.name)
        : seed.customerName;
      // AI auto-resolution replies happen in 2 minutes, whereas human agent replies take 20 minutes per message
      const delayMinutes = isSystem ? (msgIdx + 1) * 2 : (msgIdx + 1) * 20;
      const msgCreatedAt = new Date(createdAt.getTime() + delayMinutes * 60 * 1000);

      return {
        senderType: m.senderType,
        senderEmail,
        senderName,
        body: m.body,
        createdAt: msgCreatedAt,
      };
    });

    const lastMsgCreatedAt =
      messagesCreate.length > 0 ? messagesCreate[messagesCreate.length - 1].createdAt : createdAt;
    const updatedAt =
      seed.status === TicketStatus.RESOLVED || seed.status === TicketStatus.CLOSED
        ? lastMsgCreatedAt
        : createdAt;

    await prisma.ticket.create({
      data: {
        subject: seed.subject,
        customerEmail: seed.customerEmail,
        customerName: seed.customerName,
        category: seed.category,
        status: seed.status,
        priority: seed.priority,
        assignedToId: assignedAgent ? assignedAgent.id : null,
        aiSummary: seed.aiSummary,
        aiSuggestedReply: seed.aiSuggestedReply,
        createdAt,
        updatedAt,
        messages: {
          create: messagesCreate,
        },
      },
    });
  }

  console.log(`✅ Seeded ${REAL_LIFE_TICKETS.length} diverse tickets with conversation threads`);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
