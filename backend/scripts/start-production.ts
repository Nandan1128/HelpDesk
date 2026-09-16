import { execSync } from 'child_process';
import { prisma } from '../src/db/prisma.js';
import { Role, TicketCategory } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

async function runMigrations() {
  console.log('🔄 Synchronizing database schema (prisma db push)...');
  try {
    execSync('bun x prisma db push --accept-data-loss', {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('✅ Database schema synchronized successfully.');
  } catch (error) {
    console.error('❌ Failed to synchronize database schema:', error);
    process.exit(1);
  }
}

async function ensureInitialAdminAndData() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('🌱 Fresh database detected. Creating initial administrator account...');

      const adminEmail = process.env.ADMIN_EMAIL || 'admin@ticketai.local';
      const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
      const adminName = process.env.ADMIN_NAME || 'System Administrator';

      const hashedPassword = await hashPassword(adminPassword);
      const admin = await prisma.user.create({
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

      console.log(`✅ Initial Admin Account created: ${adminEmail}`);

      // Seed initial Knowledge Base Articles
      const kbCount = await prisma.knowledgeBaseArticle.count();
      if (kbCount === 0) {
        console.log('📚 Seeding foundational Knowledge Base articles...');
        await prisma.knowledgeBaseArticle.createMany({
          data: [
            {
              title: 'Refund and Return Policy',
              content:
                'Customers may request a full refund within 30 days of purchase for unused items in original packaging. Digital subscriptions can be cancelled at any time and refunded pro-rata within 14 days.',
              category: TicketCategory.REFUND_REQUEST,
            },
            {
              title: 'Account Password Reset & Login Troubleshooting',
              content:
                'To reset your password, navigate to the Login page and click "Forgot Password". A secure recovery link will be sent to your registered email address within 5 minutes.',
              category: TicketCategory.GENERAL_QUESTION,
            },
            {
              title: 'API Integration & Webhook Setup Guide',
              content:
                'Our REST API allows seamless integration with ticketing and CRM workflows. Inbound emails can be ingested via the /api/emails/webhook endpoint with HMAC signature verification.',
              category: TicketCategory.TECHNICAL_QUESTION,
            },
          ],
        });
        console.log('✅ Foundational Knowledge Base articles seeded.');
      }
    } else {
      console.log(`ℹ️ Existing database detected (${userCount} user accounts). Skipping initial seed.`);
    }
  } catch (error) {
    console.error('⚠️ Warning during database verification/seed:', error);
  }
}

async function main() {
  console.log('====================================================');
  console.log('🚀 Launching TicketAI in Production Mode (Railway)');
  console.log('====================================================');

  await runMigrations();
  await ensureInitialAdminAndData();

  console.log('🌟 Starting Express Web Server...');
  await import('../src/index.ts');
}

main().catch((err) => {
  console.error('💥 Fatal error during production startup:', err);
  process.exit(1);
});
