import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import { prisma } from '../../db/prisma.js';
import userRoutes from '../user.routes.js';
import { Role } from '@prisma/client';

import { auth } from '../../lib/auth.js';
import { hashPassword } from 'better-auth/crypto';

describe('User Routes & Logic Tests (DELETE /api/users/:id)', () => {
  let server: any;
  let baseUrl: string;
  let adminUserId: string;
  let authHeaders: Record<string, string>;
  const createdUserIds: string[] = [];
  const createdTicketIds: string[] = [];

  beforeAll(async () => {
    const adminEmail = `admin_${Date.now()}@example.com`;
    const adminPassword = 'AdminPassword123!';
    const hashedPassword = await hashPassword(adminPassword);

    // Create an admin user in database
    const admin = await prisma.user.create({
      data: {
        name: 'Admin Test',
        email: adminEmail,
        role: Role.ADMIN,
        isActive: true,
        emailVerified: true,
      },
    });
    adminUserId = admin.id;
    createdUserIds.push(admin.id);

    await prisma.account.create({
      data: {
        accountId: admin.id,
        userId: admin.id,
        providerId: 'credential',
        issuer: 'local:credential',
        password: hashedPassword,
      },
    });

    // Sign in via Better Auth to obtain official signed session cookie
    const signInRes = await auth.api.signInEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
      },
      asResponse: true,
    });
    const cookie = signInRes.headers.get('set-cookie');

    // Set up express app
    const app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    authHeaders = {
      Cookie: cookie || '',
      'Content-Type': 'application/json',
    };
  });

  afterAll(async () => {
    // Cleanup tickets
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({
        where: { id: { in: createdTicketIds } },
      });
    }

    // Cleanup users
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    if (server) {
      server.close();
    }
  });

  test('DELETE /api/users/:id soft deletes user and unassigns all assigned tickets', async () => {
    // Create an agent user
    const agent = await prisma.user.create({
      data: {
        name: 'Agent To Delete',
        email: `agent_delete_${Date.now()}@example.com`,
        role: Role.AGENT,
        isActive: true,
      },
    });
    createdUserIds.push(agent.id);

    // Create 2 tickets assigned to this agent
    const t1 = await prisma.ticket.create({
      data: {
        subject: `Assigned Ticket 1 ${Date.now()}`,
        customerEmail: 'customer1@example.com',
        assignedToId: agent.id,
      },
    });
    createdTicketIds.push(t1.id);

    const t2 = await prisma.ticket.create({
      data: {
        subject: `Assigned Ticket 2 ${Date.now()}`,
        customerEmail: 'customer2@example.com',
        assignedToId: agent.id,
      },
    });
    createdTicketIds.push(t2.id);

    // Verify tickets are assigned to agent
    const preCheck = await prisma.ticket.findMany({
      where: { id: { in: [t1.id, t2.id] } },
    });
    expect(preCheck.every((t) => t.assignedToId === agent.id)).toBe(true);

    // Call DELETE /api/users/:id
    const res = await fetch(`${baseUrl}/api/users/${agent.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(res.status).toBe(200);

    const data = (await res.json()) as any;
    expect(data.user.isActive).toBe(false);
    expect(data.user.deletedAt).not.toBeNull();
    expect(data.user._count.assignedTickets).toBe(0);

    // Verify tickets in database have assignedToId set to null
    const postCheck = await prisma.ticket.findMany({
      where: { id: { in: [t1.id, t2.id] } },
    });
    expect(postCheck.length).toBe(2);
    expect(postCheck[0].assignedToId).toBeNull();
    expect(postCheck[1].assignedToId).toBeNull();
  });

  test('DELETE /api/users/:id returns 400 when attempting to delete an ADMIN account', async () => {
    const res = await fetch(`${baseUrl}/api/users/${adminUserId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as any;
    expect(data.error).toContain('Administrator accounts cannot be deleted');
  });

  test('DELETE /api/users/:id returns 404 when user does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/users/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as any;
    expect(data.error).toContain('User not found');
  });

  test('GET /api/users excludes the AI agent from the user list', async () => {
    // Ensure AI agent exists in DB
    const aiEmail = (process.env.AI_AGENT_EMAIL || 'ai@ticketai.local').toLowerCase().trim();
    let aiUser = await prisma.user.findFirst({
      where: { email: aiEmail },
    });
    if (!aiUser) {
      aiUser = await prisma.user.create({
        data: {
          name: 'AI',
          email: aiEmail,
          role: Role.AGENT,
          isActive: true,
          emailVerified: true,
        },
      });
      createdUserIds.push(aiUser.id);
    }

    const res = await fetch(`${baseUrl}/api/users`, {
      headers: authHeaders,
    });
    expect(res.status).toBe(200);

    const data = (await res.json()) as { users: Array<{ email: string; name: string }> };
    const foundAi = data.users.find(
      (u) => u.email.toLowerCase() === aiEmail || (u.name === 'AI')
    );
    expect(foundAi).toBeUndefined();
  });

  test('GET /api/users/:id returns 404 for the AI agent account', async () => {
    const aiEmail = (process.env.AI_AGENT_EMAIL || 'ai@ticketai.local').toLowerCase().trim();
    const aiUser = await prisma.user.findFirst({
      where: { email: aiEmail },
    });
    if (aiUser) {
      const res = await fetch(`${baseUrl}/api/users/${aiUser.id}`, {
        headers: authHeaders,
      });
      expect(res.status).toBe(404);
    }
  });

  test('DELETE /api/users/:id returns 404 when attempting to delete the AI agent account', async () => {
    const aiEmail = (process.env.AI_AGENT_EMAIL || 'ai@ticketai.local').toLowerCase().trim();
    const aiUser = await prisma.user.findFirst({
      where: { email: aiEmail },
    });
    if (aiUser) {
      const res = await fetch(`${baseUrl}/api/users/${aiUser.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      expect(res.status).toBe(404);
    }
  });
});
