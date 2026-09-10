import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import { prisma } from '../../db/prisma.js';
import ticketRoutes, { formatResolutionDuration } from '../ticket.routes.js';
import { TicketStatus, Priority, TicketCategory, SenderType, Role } from '@prisma/client';
import { auth } from '../../lib/auth.js';
import { hashPassword } from 'better-auth/crypto';

describe('Dashboard Routes & Metrics Tests (GET /api/tickets/dashboard)', () => {
  let server: any;
  let baseUrl: string;
  let authHeaders: Record<string, string>;
  const createdTicketIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    // 1. Create a test admin user for authenticated requests
    const adminEmail = `dashboard_admin_${Date.now()}@example.com`;
    const adminPassword = 'Password@123';
    const hashedPassword = await hashPassword(adminPassword);

    const admin = await prisma.user.create({
      data: {
        name: 'Dashboard Admin',
        email: adminEmail,
        role: Role.ADMIN,
        isActive: true,
        emailVerified: true,
      },
    });
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

    const signInRes = await auth.api.signInEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
      },
      asResponse: true,
    });
    const cookie = signInRes.headers.get('set-cookie');
    authHeaders = cookie ? { Cookie: cookie } : {};

    // 2. Set up test Express server
    const app = express();
    app.use(express.json());
    app.use('/api/tickets', ticketRoutes);

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // 3. Seed test tickets for dashboard calculations:
    // - Ticket 1: OPEN ticket (General Question, High priority)
    // - Ticket 2: AI-RESOLVED ticket (General Question, resolved in 3 mins with SYSTEM message)
    // - Ticket 3: HUMAN-RESOLVED ticket (Technical Question, resolved in 30 mins with AGENT message)
    const now = Date.now();

    const t1 = await prisma.ticket.create({
      data: {
        subject: `Active Open Ticket ${now}`,
        customerEmail: `open_${now}@example.com`,
        customerName: 'Open Customer',
        status: TicketStatus.OPEN,
        priority: Priority.HIGH,
        category: TicketCategory.GENERAL_QUESTION,
        createdAt: new Date(now - 120000),
      },
    });
    createdTicketIds.push(t1.id);

    // AI Resolved ticket
    const aiCreatedAt = new Date(now - 300000);
    const aiResolvedAt = new Date(now - 120000); // 3 minutes after creation
    const t2 = await prisma.ticket.create({
      data: {
        subject: `AI Handled Ticket ${now}`,
        customerEmail: `ai_${now}@example.com`,
        customerName: 'AI Customer',
        status: TicketStatus.RESOLVED,
        priority: Priority.LOW,
        category: TicketCategory.GENERAL_QUESTION,
        aiSummary: 'Auto-resolved by AI based on Knowledge Base: Answered via Section 1',
        createdAt: aiCreatedAt,
        updatedAt: aiResolvedAt,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: `ai_${now}@example.com`,
              senderName: 'AI Customer',
              body: 'How do I reset password?',
              createdAt: aiCreatedAt,
            },
            {
              senderType: SenderType.SYSTEM,
              senderEmail: 'support@ticketai.local',
              senderName: 'TicketAI Support',
              body: 'You can reset your password at /forgot-password.',
              createdAt: aiResolvedAt,
            },
          ],
        },
      },
    });
    createdTicketIds.push(t2.id);

    // Human Agent Resolved ticket
    const humanCreatedAt = new Date(now - 1800000); // 30 minutes ago
    const humanResolvedAt = new Date(now - 60000); // 29 minutes after creation
    const t3 = await prisma.ticket.create({
      data: {
        subject: `Agent Resolved Ticket ${now}`,
        customerEmail: `human_${now}@example.com`,
        customerName: 'Human Customer',
        status: TicketStatus.RESOLVED,
        priority: Priority.MEDIUM,
        category: TicketCategory.TECHNICAL_QUESTION,
        createdAt: humanCreatedAt,
        updatedAt: humanResolvedAt,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: `human_${now}@example.com`,
              senderName: 'Human Customer',
              body: 'I have a tricky technical bug',
              createdAt: humanCreatedAt,
            },
            {
              senderType: SenderType.AGENT,
              senderEmail: 'agent@ticketai.local',
              senderName: 'Support Agent',
              body: 'We investigated and fixed the issue.',
              createdAt: humanResolvedAt,
            },
          ],
        },
      },
    });
    createdTicketIds.push(t3.id);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (createdTicketIds.length > 0) {
      await prisma.message.deleteMany({
        where: { ticketId: { in: createdTicketIds } },
      });
      await prisma.ticket.deleteMany({
        where: { id: { in: createdTicketIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.account.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  test('Duration helper formatResolutionDuration formats durations correctly', () => {
    expect(formatResolutionDuration(0)).toBe('0m');
    expect(formatResolutionDuration(-500)).toBe('0m');
    expect(formatResolutionDuration(3 * 60 * 1000)).toBe('3m');
    expect(formatResolutionDuration(65 * 60 * 1000)).toBe('1h 5m');
    expect(formatResolutionDuration(120 * 60 * 1000)).toBe('2h');
    expect(formatResolutionDuration((25 * 60 + 30) * 60 * 1000)).toBe('1d 1h');
  });

  test('GET /api/tickets/dashboard rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/dashboard`);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Unauthorized');
  });

  test('GET /api/tickets/dashboard returns valid metrics, breakdown, and recent tickets', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/dashboard`, {
      headers: authHeaders,
    });
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      metrics: {
        totalTickets: number;
        openTickets: number;
        resolvedTickets: number;
        closedTickets: number;
        aiResolvedTickets: number;
        aiResolvedPercentage: number;
        aiResolvedRateOfResolved: number;
        averageResolutionTimeMs: number;
        averageResolutionTimeFormatted: string;
        aiAverageResolutionTimeMs: number;
        aiAverageResolutionTimeFormatted: string;
        humanAverageResolutionTimeMs: number;
        humanAverageResolutionTimeFormatted: string;
      };
      categoryBreakdown: Array<{
        category: string;
        count: number;
        percentage: number;
      }>;
      recentTickets: Array<{
        id: string;
        ticketNumber: number;
        subject: string;
        status: string;
        category: string;
        priority: string;
        autoResolved: boolean;
        createdAt: string;
      }>;
      ticketsPerDay: Array<{
        date: string;
        formattedDate: string;
        count: number;
      }>;
    };

    expect(data.metrics).toBeDefined();
    expect(typeof data.metrics.totalTickets).toBe('number');
    expect(data.metrics.totalTickets).toBeGreaterThanOrEqual(3);

    expect(typeof data.metrics.openTickets).toBe('number');
    expect(data.metrics.openTickets).toBeGreaterThanOrEqual(1);

    expect(typeof data.metrics.aiResolvedTickets).toBe('number');
    expect(data.metrics.aiResolvedTickets).toBeGreaterThanOrEqual(1);

    expect(typeof data.metrics.aiResolvedPercentage).toBe('number');
    expect(data.metrics.aiResolvedPercentage).toBeGreaterThan(0);

    expect(typeof data.metrics.averageResolutionTimeMs).toBe('number');
    expect(data.metrics.averageResolutionTimeMs).toBeGreaterThan(0);
    expect(typeof data.metrics.averageResolutionTimeFormatted).toBe('string');
    expect(data.metrics.averageResolutionTimeFormatted).toMatch(/\d+[mhd]/);

    // AI resolution speed should be recorded and fast (< 10 minutes)
    expect(data.metrics.aiAverageResolutionTimeMs).toBeGreaterThan(0);
    expect(data.metrics.aiAverageResolutionTimeFormatted).toBeDefined();

    // Category breakdown should contain all 3 categories
    expect(Array.isArray(data.categoryBreakdown)).toBe(true);
    expect(data.categoryBreakdown.length).toBe(3);
    const categories = data.categoryBreakdown.map((c) => c.category);
    expect(categories).toContain(TicketCategory.GENERAL_QUESTION);
    expect(categories).toContain(TicketCategory.TECHNICAL_QUESTION);
    expect(categories).toContain(TicketCategory.REFUND_REQUEST);

    // Recent tickets should be an array of at most 5 items
    expect(Array.isArray(data.recentTickets)).toBe(true);
    expect(data.recentTickets.length).toBeGreaterThanOrEqual(3);
    expect(data.recentTickets.length).toBeLessThanOrEqual(5);

    // One of the recent tickets should have autoResolved = true
    const hasAutoResolved = data.recentTickets.some((t) => t.autoResolved);
    expect(hasAutoResolved).toBe(true);

    // Tickets per day over the past 30 days should contain 30 daily data points
    expect(Array.isArray(data.ticketsPerDay)).toBe(true);
    expect(data.ticketsPerDay.length).toBe(30);
    for (const day of data.ticketsPerDay) {
      expect(typeof day.date).toBe('string');
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof day.formattedDate).toBe('string');
      expect(typeof day.count).toBe('number');
      expect(day.count).toBeGreaterThanOrEqual(0);
    }
    // Since 3 test tickets were created today, today's entry should have count >= 3
    const todayEntry = data.ticketsPerDay[data.ticketsPerDay.length - 1];
    expect(todayEntry.count).toBeGreaterThanOrEqual(3);
  });
});
