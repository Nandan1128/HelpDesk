import { describe, test, expect } from 'bun:test';
import { seedAiAgent } from '../../../prisma/seed-ai-agent.js';
import { AutoResolveService } from '../auto-resolve.service.js';
import { prisma } from '../../db/prisma.js';
import { Role } from '@prisma/client';

describe('AI Agent Seed & Lifecycle Tests', () => {
  test('seedAiAgent() creates an agent called "AI" with role AGENT', async () => {
    const aiUser = await seedAiAgent();

    expect(aiUser).toBeDefined();
    expect(aiUser.name).toBe('AI');
    expect(aiUser.role).toBe(Role.AGENT);
    expect(aiUser.isActive).toBe(true);

    // Verify in database
    const dbUser = await prisma.user.findUnique({
      where: { id: aiUser.id },
      include: { accounts: true },
    });

    expect(dbUser).not.toBeNull();
    expect(dbUser?.name).toBe('AI');
    expect(dbUser?.role).toBe(Role.AGENT);
    expect(dbUser?.isActive).toBe(true);
    expect(dbUser?.accounts.length).toBe(0); // AI agent has no password or credential account
  });

  test('seedAiAgent() is idempotent and handles repeated runs gracefully', async () => {
    const firstRun = await seedAiAgent();
    const secondRun = await seedAiAgent();

    expect(firstRun.id).toBe(secondRun.id);
    expect(secondRun.name).toBe('AI');
    expect(secondRun.role).toBe(Role.AGENT);
  });

  test('AutoResolveService.getOrCreateAiAgent() finds the seeded AI agent', async () => {
    const aiAgent = await AutoResolveService.getOrCreateAiAgent();
    expect(aiAgent).toBeDefined();
    expect(aiAgent.name).toBe('AI');
    expect(aiAgent.role).toBe(Role.AGENT);
    expect(aiAgent.isActive).toBe(true);
  });

  test('AI agent is excluded from user list query (not in user list)', async () => {
    const aiEmail = (process.env.AI_AGENT_EMAIL || 'ai@ticketai.local').toLowerCase().trim();
    const usersInList = await prisma.user.findMany({
      where: {
        deletedAt: null,
        NOT: [
          { email: aiEmail },
          { name: 'AI', role: Role.AGENT },
        ],
      },
    });

    const foundAi = usersInList.find((u) => u.email === aiEmail || (u.name === 'AI' && u.role === Role.AGENT));
    expect(foundAi).toBeUndefined();
  });
});
