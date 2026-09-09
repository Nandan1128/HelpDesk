import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import { prisma } from '../../db/prisma.js';
import ticketRoutes from '../ticket.routes.js';
import { TicketStatus, Priority, TicketCategory } from '@prisma/client';
import { QueueService } from '../../services/queue.service.js';

describe('Ticket Routes & Logic Tests (GET /api/tickets)', () => {
  const createdTicketIds: string[] = [];
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/tickets', ticketRoutes);

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;

    // Seed 3 test tickets with staggered creation times
    const now = Date.now();

    const t1 = await prisma.ticket.create({
      data: {
        subject: `Oldest Ticket ${now}`,
        customerEmail: `customer_old_${now}@example.com`,
        customerName: 'Old Customer',
        status: TicketStatus.CLOSED,
        priority: Priority.LOW,
        category: TicketCategory.GENERAL_QUESTION,
        createdAt: new Date(now - 100000),
      },
    });
    createdTicketIds.push(t1.id);

    const t2 = await prisma.ticket.create({
      data: {
        subject: `Middle Ticket ${now}`,
        customerEmail: `customer_mid_${now}@example.com`,
        customerName: 'Middle Customer',
        status: TicketStatus.RESOLVED,
        priority: Priority.MEDIUM,
        category: TicketCategory.TECHNICAL_QUESTION,
        createdAt: new Date(now - 50000),
      },
    });
    createdTicketIds.push(t2.id);

    const t3 = await prisma.ticket.create({
      data: {
        subject: `Newest Ticket ${now}`,
        customerEmail: `customer_new_${now}@example.com`,
        customerName: 'New Customer',
        status: TicketStatus.OPEN,
        priority: Priority.HIGH,
        category: TicketCategory.REFUND_REQUEST,
        createdAt: new Date(now),
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
    await QueueService.stop();
  });

  test('GET /api/tickets rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets`);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('Unauthorized');
  });

  test('GET /api/tickets/:id rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}`);
    expect(res.status).toBe(401);
  });

  test('Default Query Logic: Sorts tickets by newest first (createdAt: desc)', async () => {
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: createdTicketIds } },
      orderBy: { createdAt: 'desc' },
    });

    expect(tickets.length).toBe(3);
    expect(tickets[0].subject).toContain('Newest Ticket');
    expect(tickets[1].subject).toContain('Middle Ticket');
    expect(tickets[2].subject).toContain('Oldest Ticket');

    // Strictly assert descending order
    expect(new Date(tickets[0].createdAt).getTime()).toBeGreaterThan(
      new Date(tickets[1].createdAt).getTime()
    );
    expect(new Date(tickets[1].createdAt).getTime()).toBeGreaterThan(
      new Date(tickets[2].createdAt).getTime()
    );
  });

  test('Status Filtering: Filters tickets correctly', async () => {
    const openTickets = await prisma.ticket.findMany({
      where: { id: { in: createdTicketIds }, status: TicketStatus.OPEN },
    });
    expect(openTickets.length).toBe(1);
    expect(openTickets[0].subject).toContain('Newest Ticket');

    const resolvedTickets = await prisma.ticket.findMany({
      where: { id: { in: createdTicketIds }, status: TicketStatus.RESOLVED },
    });
    expect(resolvedTickets.length).toBe(1);
    expect(resolvedTickets[0].subject).toContain('Middle Ticket');
  });

  test('Priority Filtering: Filters by priority', async () => {
    const highPriorityTickets = await prisma.ticket.findMany({
      where: { id: { in: createdTicketIds }, priority: Priority.HIGH },
    });
    expect(highPriorityTickets.length).toBe(1);
    expect(highPriorityTickets[0].priority).toBe('HIGH');
  });

  test('Category Filtering: Filters by category', async () => {
    const refundTickets = await prisma.ticket.findMany({
      where: { id: { in: createdTicketIds }, category: TicketCategory.REFUND_REQUEST },
    });
    expect(refundTickets.length).toBe(1);
    expect(refundTickets[0].category).toBe('REFUND_REQUEST');
  });

  test('Search: Finds tickets by customer email, name, or subject', async () => {
    const searchResults = await prisma.ticket.findMany({
      where: {
        id: { in: createdTicketIds },
        OR: [
          { subject: { contains: 'Middle', mode: 'insensitive' } },
          { customerEmail: { contains: 'customer_mid_', mode: 'insensitive' } },
        ],
      },
    });

    expect(searchResults.length).toBe(1);
    expect(searchResults[0].subject).toContain('Middle Ticket');
  });

  test('GET /api/tickets/agents rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/agents`);
    expect(res.status).toBe(401);
  });

  test('PATCH /api/tickets/:id rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: TicketStatus.RESOLVED }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/:id/messages rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Test response message' }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/polish rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/polish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: 'Sample response' }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/:id/polish rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/polish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: 'Sample response' }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/summarize rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: createdTicketIds[0] }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/:id/summarize rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Cannot login',
        customerEmail: 'user@example.com',
      }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/classify rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Cannot login',
        body: 'Server gave 500 error',
      }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/:id/classify rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/tickets/:id/auto-resolve rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/tickets/${createdTicketIds[0]}/auto-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  test('Ticket List Filtering: Excludes NEW and PROCESSING tickets from the active list', async () => {
    const now = Date.now();

    // Create a NEW ticket and a PROCESSING ticket
    const newTicket = await prisma.ticket.create({
      data: {
        subject: `New Arriving Ticket ${now}`,
        customerEmail: `new_arrive_${now}@example.com`,
        status: TicketStatus.NEW,
        priority: Priority.MEDIUM,
        category: TicketCategory.GENERAL_QUESTION,
      },
    });
    createdTicketIds.push(newTicket.id);

    const processingTicket = await prisma.ticket.create({
      data: {
        subject: `Processing Ticket ${now}`,
        customerEmail: `processing_${now}@example.com`,
        status: TicketStatus.PROCESSING,
        priority: Priority.HIGH,
        category: TicketCategory.TECHNICAL_QUESTION,
      },
    });
    createdTicketIds.push(processingTicket.id);

    // Query database simulating GET /api/tickets default filter: notIn [NEW, PROCESSING]
    const activeTickets = await prisma.ticket.findMany({
      where: {
        id: { in: createdTicketIds },
        status: { notIn: [TicketStatus.NEW, TicketStatus.PROCESSING] },
      },
    });

    const activeIds = activeTickets.map((t) => t.id);
    expect(activeIds).not.toContain(newTicket.id);
    expect(activeIds).not.toContain(processingTicket.id);

    // The 3 initial tickets (CLOSED, RESOLVED, OPEN) should be in activeTickets
    expect(activeTickets.length).toBe(3);
  });

  test('Ticket Details: Retrieves single ticket with messages and relation details', async () => {
    const ticket = await prisma.ticket.findUnique({
      where: { id: createdTicketIds[0] },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    expect(ticket).not.toBeNull();
    expect(ticket?.id).toBe(createdTicketIds[0]);
    expect(Array.isArray(ticket?.messages)).toBe(true);

    // Also verify retrieval by numeric ticketNumber
    const ticketByNumber = await prisma.ticket.findUnique({
      where: { ticketNumber: ticket!.ticketNumber },
    });
    expect(ticketByNumber).not.toBeNull();
    expect(ticketByNumber?.id).toBe(ticket?.id);
  });
});

