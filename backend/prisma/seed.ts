import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaClient, Role, TicketStatus, TicketCategory, Priority, SenderType } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

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
      accounts: {
        create: {
          accountId: data.email,
          providerId: 'credential',
          password: hashedPassword,
        },
      },
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

  // 2. Seed Default Admin User
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
  console.log(`✅ Created Admin User: ${admin.email}`);

  // 3. Seed Sample Support Agents
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
    isActive: true,
  });

  console.log(`✅ Created Support Agents: ${agent1.email}, ${agent2.email}`);

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

  // 5. Seed Sample Tickets & Messages
  const ticket1 = await prisma.ticket.create({
    data: {
      subject: 'Refund requested for annual renewal',
      customerEmail: 'john.doe@example.com',
      customerName: 'John Doe',
      category: TicketCategory.REFUND_REQUEST,
      status: TicketStatus.OPEN,
      priority: Priority.HIGH,
      assignedToId: agent1.id,
      aiSummary: 'Customer was charged for annual subscription renewal 2 days ago and wants a full refund because their team migrated to another solution.',
      aiSuggestedReply: `Hi John,

Thank you for reaching out. I would be happy to help you with this!

Since your annual subscription renewal occurred within the last 30 days, your account is fully eligible for a full refund under our 30-day refund guarantee. I have initiated the refund process, and the funds should appear back on your original payment card within 3-5 business days.

Please let me know if you need anything else!

Best regards,
Support Team`,
      messages: {
        create: [
          {
            senderType: SenderType.CUSTOMER,
            senderEmail: 'john.doe@example.com',
            senderName: 'John Doe',
            body: 'Hello, I noticed an automatic renewal charge on my credit card yesterday for $240. We migrated to a different workflow last month and no longer need the seat. Could you please cancel and issue a refund?',
          },
        ],
      },
    },
  });

  const ticket2 = await prisma.ticket.create({
    data: {
      subject: 'Cannot login with 2FA code',
      customerEmail: 'mary.smith@company.io',
      customerName: 'Mary Smith',
      category: TicketCategory.TECHNICAL_QUESTION,
      status: TicketStatus.OPEN,
      priority: Priority.URGENT,
      assignedToId: agent2.id,
      aiSummary: 'Customer lost access to authenticator app on new phone and cannot complete two-factor authentication.',
      aiSuggestedReply: `Hi Mary,

Sorry to hear you are having trouble logging in!

If you switched phones and lost access to your authenticator app, you can log in using one of the 16-character backup recovery codes generated when 2FA was initially set up. 

If you do not have your recovery codes handy, please reply to this email confirming your account billing address, and we will guide you through identity verification to reset your 2FA.

Best regards,
Support Team`,
      messages: {
        create: [
          {
            senderType: SenderType.CUSTOMER,
            senderEmail: 'mary.smith@company.io',
            senderName: 'Mary Smith',
            body: 'Hi, I got a new phone over the weekend and my Google Authenticator codes are gone. Now I am locked out of my dashboard. Please help!',
          },
        ],
      },
    },
  });

  const ticket3 = await prisma.ticket.create({
    data: {
      subject: 'How do I download past invoices for tax purposes?',
      customerEmail: 'finance@startup.co',
      customerName: 'Dave Miller',
      category: TicketCategory.GENERAL_QUESTION,
      status: TicketStatus.RESOLVED,
      priority: Priority.LOW,
      assignedToId: agent1.id,
      aiSummary: 'Customer asked where to download tax invoices for 2025.',
      aiSuggestedReply: 'Hi Dave, you can download all past invoices directly under Settings > Billing in your account dashboard.',
      messages: {
        create: [
          {
            senderType: SenderType.CUSTOMER,
            senderEmail: 'finance@startup.co',
            senderName: 'Dave Miller',
            body: 'Where can I find PDF copies of our invoices for the previous fiscal year?',
          },
          {
            senderType: SenderType.AGENT,
            senderEmail: agent1.email,
            senderName: agent1.name,
            body: 'Hi Dave,\n\nYou can access and download all historical PDF invoices anytime by going to Settings > Billing and clicking "Download Invoices". Let us know if you need anything else!\n\nBest regards,\nSarah',
          },
        ],
      },
    },
  });
  console.log(`✅ Seeded ${3} initial tickets with conversation messages`);

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
