import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { PrismaClient, Role } from '@prisma/client';

// Load test environment if NODE_ENV is test
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
}
dotenv.config();

const prisma = new PrismaClient();

/**
 * Creates or updates the dedicated AI support agent account (no password).
 */
export async function seedAiAgent() {
  const aiEmail = (process.env.AI_AGENT_EMAIL || 'ai@ticketai.local').toLowerCase().trim();
  const aiName = 'AI';

  console.log(`🌱 Seeding AI Agent (${aiName} <${aiEmail}>)...`);

  // Check if AI agent already exists by email or name
  let aiUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: aiEmail },
        { name: aiName, role: Role.AGENT, deletedAt: null },
      ],
    },
  });

  if (aiUser) {
    aiUser = await prisma.user.update({
      where: { id: aiUser.id },
      data: {
        name: aiName,
        email: aiEmail,
        role: Role.AGENT,
        isActive: true,
        deletedAt: null,
      },
    });
    console.log(`✅ Existing AI Agent updated: ${aiUser.name} (${aiUser.email}, ID: ${aiUser.id})`);
  } else {
    aiUser = await prisma.user.create({
      data: {
        name: aiName,
        email: aiEmail,
        role: Role.AGENT,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`✅ Created AI Agent: ${aiUser.name} (${aiUser.email}, ID: ${aiUser.id})`);
  }

  // The AI agent is a system virtual agent and must NOT have a password or credential account
  await prisma.account.deleteMany({
    where: { userId: aiUser.id },
  });

  return aiUser;
}

// Allow direct execution from CLI: bun prisma/seed-ai-agent.ts
const isCLI = Boolean(
  process.argv[1] &&
    (process.argv[1].endsWith('seed-ai-agent.ts') || process.argv[1].endsWith('seed-ai-agent.js'))
);

if (isCLI) {
  seedAiAgent()
    .then(() => {
      console.log('🎉 AI Agent seeding completed successfully!');
      process.exit(0);
    })
    .catch((e) => {
      console.error('❌ Failed to seed AI Agent:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
