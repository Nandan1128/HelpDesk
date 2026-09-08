import { Ticket } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { AIService, TicketClassificationResult } from './ai.service.js';

export interface ClassifyTicketResult {
  ticket: Ticket;
  classification: TicketClassificationResult;
}

export class TicketClassifierService {
  /**
   * Classifies a ticket by ticketId or numeric ticketNumber using Google Gemini,
   * and updates its category and priority in the database.
   * If GEMINI_API_KEY is not configured, logs a notice and skips classification gracefully.
   */
  static async classifyTicket(
    ticketId: string,
    options?: { apiKey?: string; modelName?: string }
  ): Promise<ClassifyTicketResult | null> {
    const isNumeric = /^\d+$/.test(ticketId);
    const where = isNumeric
      ? { ticketNumber: parseInt(ticketId, 10) }
      : { id: ticketId };

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 5,
        },
      },
    });

    if (!ticket) {
      console.warn(`[Ticket Classifier] Ticket not found: ${ticketId}`);
      return null;
    }

    const apiKey = options?.apiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn(
        `[Ticket Classifier] GEMINI_API_KEY is not configured. Skipping automatic classification for ticket ${ticket.id} (#${ticket.ticketNumber}).`
      );
      return null;
    }

    // Extract customer message body
    const firstCustomerMessage =
      ticket.messages.find((m) => m.senderType === 'CUSTOMER') || ticket.messages[0];
    const body = firstCustomerMessage?.body || '';

    const classification = await AIService.classifyTicket({
      subject: ticket.subject,
      body,
      customerName: ticket.customerName,
      customerEmail: ticket.customerEmail,
      apiKey: options?.apiKey,
      modelName: options?.modelName,
    });

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        category: classification.category,
        priority: classification.priority,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    console.log(
      `[Ticket Classifier] Ticket #${updatedTicket.ticketNumber} classified -> Category: ${updatedTicket.category}, Priority: ${updatedTicket.priority} (Reasoning: ${classification.reasoning})`
    );

    return {
      ticket: updatedTicket,
      classification,
    };
  }

  /**
   * Triggers ticket classification in a strictly non-blocking fashion.
   * Defers execution via setImmediate so callers (such as inbound email webhooks)
   * can return an immediate HTTP 200/201 response without waiting for Gemini.
   * Internal errors are safely caught and logged, preventing unhandled promise rejections.
   */
  static classifyTicketNonBlocking(
    ticketId: string,
    options?: { apiKey?: string; modelName?: string }
  ): Promise<ClassifyTicketResult | null> {
    const task = (async () => {
      // Yield execution to the next event-loop tick so the caller's response flushes first
      await new Promise((resolve) => setImmediate(resolve));
      try {
        return await this.classifyTicket(ticketId, options);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[Ticket Classifier] Non-blocking classification error for ticket ${ticketId}:`,
          message
        );
        return null;
      }
    })();

    // Attach catch handler to ensure no unhandled promise rejection if caller does not await
    task.catch(() => {});
    return task;
  }
}
