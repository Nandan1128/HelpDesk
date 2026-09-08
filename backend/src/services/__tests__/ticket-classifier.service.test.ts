import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { TicketClassifierService } from '../ticket-classifier.service.js';
import { prisma } from '../../db/prisma.js';
import { TicketCategory, Priority, TicketStatus, SenderType } from '@prisma/client';
import { env } from '../../config/env.js';

describe('TicketClassifierService Tests', () => {
  let createdTicketId: string;

  beforeAll(async () => {
    // Create a sample ticket for testing
    const ticket = await prisma.ticket.create({
      data: {
        subject: 'API returning 502 Bad Gateway intermittently',
        customerEmail: 'devops@example.com',
        customerName: 'DevOps Lead',
        status: TicketStatus.OPEN,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.MEDIUM,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail: 'devops@example.com',
              senderName: 'DevOps Lead',
              body: 'Our gateway reverse proxy keeps receiving 502 errors when calling the upstream service.',
            },
          ],
        },
      },
    });
    createdTicketId = ticket.id;
  });

  afterAll(async () => {
    if (createdTicketId) {
      await prisma.ticket.deleteMany({
        where: { id: createdTicketId },
      });
    }
  });

  test('returns null gracefully when ticket does not exist', async () => {
    const result = await TicketClassifierService.classifyTicket('non-existent-uuid-12345');
    expect(result).toBeNull();
  });

  test('classifyTicket skips classification when GEMINI_API_KEY is missing without throwing', async () => {
    // In test environment, env.GEMINI_API_KEY is empty
    const result = await TicketClassifierService.classifyTicket(createdTicketId, {
      apiKey: '',
    });
    expect(result).toBeNull();

    // Verify ticket in DB was not altered
    const ticket = await prisma.ticket.findUnique({ where: { id: createdTicketId } });
    expect(ticket).not.toBeNull();
    expect(ticket?.category).toBe(TicketCategory.GENERAL_QUESTION);
    expect(ticket?.priority).toBe(Priority.MEDIUM);
  });

  test('classifyTicketNonBlocking returns a non-blocking promise without throwing', async () => {
    // Calling non-blocking with invalid or missing key should never throw unhandled rejection
    const promise = TicketClassifierService.classifyTicketNonBlocking(createdTicketId, {
      apiKey: '',
    });

    expect(promise).toBeInstanceOf(Promise);
    const result = await promise;
    expect(result).toBeNull();
  });

  test('classifyTicket classifies and updates ticket when API key is available', async () => {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      const result = await TicketClassifierService.classifyTicket(createdTicketId, {
        apiKey,
      });

      expect(result).not.toBeNull();
      expect(result?.classification.category).toBe(TicketCategory.TECHNICAL_QUESTION);
      expect(['HIGH', 'URGENT']).toContain(result?.classification.priority);

      // Verify DB was updated
      const updated = await prisma.ticket.findUnique({ where: { id: createdTicketId } });
      expect(updated?.category).toBe(TicketCategory.TECHNICAL_QUESTION);
      expect(['HIGH', 'URGENT']).toContain(updated?.priority);
    }
  });

  test('classifyTicketNonBlocking classifies in background and updates DB when API key is available', async () => {
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey) {
      // Reset ticket category and priority first
      await prisma.ticket.update({
        where: { id: createdTicketId },
        data: {
          category: TicketCategory.GENERAL_QUESTION,
          priority: Priority.LOW,
        },
      });

      // Fire non-blocking classification
      const task = TicketClassifierService.classifyTicketNonBlocking(createdTicketId, {
        apiKey,
      });

      // Await background task completion
      const res = await task;
      expect(res).not.toBeNull();

      const ticketInDb = await prisma.ticket.findUnique({ where: { id: createdTicketId } });
      expect(ticketInDb?.category).toBe(TicketCategory.TECHNICAL_QUESTION);
    }
  });
});
