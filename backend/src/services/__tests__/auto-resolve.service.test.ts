import { describe, test, expect, afterEach, afterAll, spyOn } from 'bun:test';
import { AutoResolveService } from '../auto-resolve.service.js';
import { AIService } from '../ai.service.js';
import { prisma } from '../../db/prisma.js';
import { TicketStatus, Priority, TicketCategory, SenderType } from '@prisma/client';
import { env } from '../../config/env.js';
import { QueueService } from '../queue.service.js';

describe('AutoResolveService Tests', () => {
  const createdTicketIds: string[] = [];

  afterEach(async () => {
    // restore any mocks
  });

  afterAll(async () => {
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

  test('returns null gracefully when ticket does not exist', async () => {
    const result = await AutoResolveService.processTicket('non-existent-uuid-999');
    expect(result).toBeNull();
  });

  test('transitions ticket from PROCESSING to OPEN when GEMINI_API_KEY is missing without throwing', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        subject: 'How do I reset my password?',
        customerEmail: 'user_nokey@example.com',
        customerName: 'NoKey User',
        status: TicketStatus.NEW,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.LOW,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: 'user_nokey@example.com',
              senderName: 'NoKey User',
              body: 'I forgot my password, how do I reset it?',
            },
          ],
        },
      },
    });
    createdTicketIds.push(ticket.id);

    const result = await AutoResolveService.processTicket(ticket.id, {
      apiKey: '',
    });

    expect(result).not.toBeNull();
    expect(result?.autoResolved).toBe(false);
    expect(result?.ticket.status).toBe(TicketStatus.OPEN);
    expect(result?.ticket.assignedToId).toBeNull();

    // Verify in database: ticket must be OPEN and unassigned from AI agent
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.status).toBe(TicketStatus.OPEN);
    expect(dbTicket?.assignedToId).toBeNull();
  });

  test('state machine: auto-resolves ticket, transitions to RESOLVED, and appends SYSTEM message', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        subject: 'Forgot password help',
        customerEmail: 'mock_autoresolve@example.com',
        customerName: 'Mock User',
        status: TicketStatus.NEW,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.LOW,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: 'mock_autoresolve@example.com',
              senderName: 'Mock User',
              body: 'I forgot my password. What should I do?',
            },
          ],
        },
      },
    });
    createdTicketIds.push(ticket.id);

    // Spy on AIService.evaluateTicketForAutoResolution to simulate high-confidence KB match
    const spy = spyOn(AIService, 'evaluateTicketForAutoResolution').mockResolvedValueOnce({
      category: TicketCategory.GENERAL_QUESTION,
      priority: Priority.MEDIUM,
      canAutoResolve: true,
      confidence: 0.95,
      resolutionMessage: 'Hi Mock User,\n\nPlease click "Forgot Password" on the login page and enter your registered email address.\n\nBest regards,\nNandan',
      reasoning: 'Grounded in KB Section 1: Account & Login Issues',
    });

    const result = await AutoResolveService.processTicket(ticket.id, {
      apiKey: 'test-mock-key',
    });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    const aiAgent = await AutoResolveService.getOrCreateAiAgent();
    expect(result).not.toBeNull();
    expect(result?.autoResolved).toBe(true);
    expect(result?.ticket.status).toBe(TicketStatus.RESOLVED);
    expect(result?.ticket.category).toBe(TicketCategory.GENERAL_QUESTION);
    expect(result?.ticket.assignedToId).toBe(aiAgent.id);

    // Verify in database: ticket must be RESOLVED and assigned to AI agent
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.status).toBe(TicketStatus.RESOLVED);
    expect(dbTicket?.assignedToId).toBe(aiAgent.id);

    // Verify SYSTEM reply message was created in DB
    const messages = await prisma.message.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages.length).toBe(2);
    const systemMsg = messages.find((m) => m.senderType === SenderType.SYSTEM);
    expect(systemMsg).toBeDefined();
    expect(systemMsg?.senderName).toBe('TicketAI Support');
    expect(systemMsg?.body).toContain('Forgot Password');
  });

  test('state machine: escalates ticket to OPEN and does not post resolution reply when escalated', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        subject: 'I want a refund outside 30 days or I will sue',
        customerEmail: 'escalated@example.com',
        customerName: 'Escalated User',
        status: TicketStatus.NEW,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.LOW,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: 'escalated@example.com',
              senderName: 'Escalated User',
              body: 'I bought this 90 days ago and I will take legal action if I do not get a refund.',
            },
          ],
        },
      },
    });
    createdTicketIds.push(ticket.id);

    // Spy on AIService to simulate escalation rule triggered
    const spy = spyOn(AIService, 'evaluateTicketForAutoResolution').mockResolvedValueOnce({
      category: TicketCategory.REFUND_REQUEST,
      priority: Priority.URGENT,
      canAutoResolve: false,
      confidence: 0.99,
      reasoning: 'Section 10 Escalation: Customer threatens legal action and requests refund outside 30-day window.',
      escalationRuleTriggered: 'Legal threat & outside 30-day window',
    });

    const result = await AutoResolveService.processTicket(ticket.id, {
      apiKey: 'test-mock-key',
    });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    expect(result).not.toBeNull();
    expect(result?.autoResolved).toBe(false);
    expect(result?.ticket.status).toBe(TicketStatus.OPEN);
    expect(result?.ticket.category).toBe(TicketCategory.REFUND_REQUEST);
    expect(result?.ticket.priority).toBe(Priority.URGENT);
    expect(result?.ticket.assignedToId).toBeNull();

    // Verify in database: ticket must be OPEN and unassigned from AI agent
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.status).toBe(TicketStatus.OPEN);
    expect(dbTicket?.assignedToId).toBeNull();

    // Verify NO system resolution message was added
    const messages = await prisma.message.findMany({
      where: { ticketId: ticket.id },
    });
    const systemMsg = messages.find((m) => m.senderType === SenderType.SYSTEM);
    expect(systemMsg).toBeUndefined();
  });

  test('state machine: safely transitions to OPEN if AIService throws an unexpected error', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        subject: 'System crash inquiry',
        customerEmail: 'error_test@example.com',
        customerName: 'Error User',
        status: TicketStatus.NEW,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.LOW,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: 'error_test@example.com',
              senderName: 'Error User',
              body: 'Testing error handling.',
            },
          ],
        },
      },
    });
    createdTicketIds.push(ticket.id);

    const spy = spyOn(AIService, 'evaluateTicketForAutoResolution').mockRejectedValueOnce(
      new Error('Simulated network timeout')
    );

    const result = await AutoResolveService.processTicket(ticket.id, {
      apiKey: 'test-mock-key',
    });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    expect(result).not.toBeNull();
    expect(result?.autoResolved).toBe(false);
    expect(result?.ticket.status).toBe(TicketStatus.OPEN);
    expect(result?.ticket.assignedToId).toBeNull();

    // Verify ticket in DB is not stuck in PROCESSING and unassigned from AI agent
    const dbTicket = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.status).toBe(TicketStatus.OPEN);
    expect(dbTicket?.assignedToId).toBeNull();
  });

  test('getOrCreateAiAgent creates and returns the dedicated AI Agent', async () => {
    const aiAgent = await AutoResolveService.getOrCreateAiAgent();
    expect(aiAgent).toBeDefined();
    expect(aiAgent.name).toBe('AI');
    expect(aiAgent.role).toBe('AGENT');
    expect(aiAgent.isActive).toBe(true);
  });
});
