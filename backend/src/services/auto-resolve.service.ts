import { Ticket, TicketStatus, SenderType } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { AIService, AutoResolveEvaluationResult } from './ai.service.js';
import { QueueService } from './queue.service.js';

export interface ProcessTicketResult {
  ticket: Ticket;
  evaluation?: AutoResolveEvaluationResult;
  autoResolved: boolean;
}

export interface ProcessTicketOptions {
  apiKey?: string;
  modelName?: string;
  knowledgeBaseContent?: string;
}

export class AutoResolveService {
  /**
   * Processes a ticket upon arrival through the AI auto-resolution state machine:
   * 1. Ticket starts in NEW state.
   * 2. Moves ticket to PROCESSING state while AI evaluates against knowledge-base.md.
   * 3. If AI can resolve based on the knowledge base (and no escalation rule is triggered):
   *    - Appends a SYSTEM reply message with the grounded solution.
   *    - Transitions ticket status to RESOLVED.
   * 4. If AI cannot resolve (or Section 10 escalation triggered):
   *    - Transitions ticket status to OPEN so it becomes visible on the ticket list for human agents.
   *    - Updates ticket category and priority.
   */
  static async processTicket(
    ticketId: string,
    options?: ProcessTicketOptions
  ): Promise<ProcessTicketResult | null> {
    const isNumeric = /^\d+$/.test(ticketId);
    const where = isNumeric
      ? { ticketNumber: parseInt(ticketId, 10) }
      : { id: ticketId };

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 10,
        },
      },
    });

    if (!ticket) {
      console.warn(`[AutoResolveService] Ticket not found: ${ticketId}`);
      return null;
    }

    // Step 1 -> Step 2: Transition ticket to PROCESSING while AI evaluates it
    const processingTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.PROCESSING },
    });

    const apiKey = options?.apiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    // Graceful fallback if GEMINI_API_KEY is not configured (e.g. CI, test env)
    if (!apiKey) {
      console.warn(
        `[AutoResolveService] GEMINI_API_KEY is not configured. Moving ticket #${ticket.ticketNumber} from PROCESSING to OPEN.`
      );
      const openTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.OPEN },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return {
        ticket: openTicket,
        autoResolved: false,
      };
    }

    // Extract first customer message body
    const firstCustomerMessage =
      ticket.messages.find((m) => m.senderType === SenderType.CUSTOMER) || ticket.messages[0];
    const body = firstCustomerMessage?.body || '';

    try {
      const evaluation = await AIService.evaluateTicketForAutoResolution({
        subject: ticket.subject,
        body,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        knowledgeBaseContent: options?.knowledgeBaseContent,
        apiKey,
        modelName: options?.modelName,
      });

      // Branch A: AI Auto-Resolved ticket -> Post SYSTEM message and transition to RESOLVED
      if (evaluation.canAutoResolve && evaluation.resolutionMessage) {
        const [, resolvedTicket] = await prisma.$transaction([
          prisma.message.create({
            data: {
              ticketId: ticket.id,
              senderType: SenderType.SYSTEM,
              senderName: 'TicketAI Support',
              senderEmail: env.SUPPORT_EMAIL,
              body: evaluation.resolutionMessage,
            },
          }),
          prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              status: TicketStatus.RESOLVED,
              category: evaluation.category,
              priority: evaluation.priority,
              aiSummary: `Auto-resolved by AI based on Knowledge Base: ${evaluation.reasoning}`,
            },
            include: {
              assignedTo: {
                select: { id: true, name: true, email: true },
              },
              messages: {
                orderBy: { createdAt: 'asc' },
              },
            },
          }),
        ]);

        console.log(
          `[AutoResolveService] Ticket #${resolvedTicket.ticketNumber} AUTO-RESOLVED by AI. Category: ${resolvedTicket.category}, Priority: ${resolvedTicket.priority}.`
        );

        return {
          ticket: resolvedTicket,
          evaluation,
          autoResolved: true,
        };
      }

      // Branch B: AI could not auto-resolve or escalated -> Transition to OPEN for human agent
      const openTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.OPEN,
          category: evaluation.category,
          priority: evaluation.priority,
          aiSummary: evaluation.escalationRuleTriggered
            ? `Escalated: ${evaluation.escalationRuleTriggered}. ${evaluation.reasoning}`
            : evaluation.reasoning,
        },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      console.log(
        `[AutoResolveService] Ticket #${openTicket.ticketNumber} moved to OPEN (Escalated / Needs Human Agent). Category: ${openTicket.category}, Priority: ${openTicket.priority}.`
      );

      return {
        ticket: openTicket,
        evaluation,
        autoResolved: false,
      };
    } catch (error) {
      console.error(`[AutoResolveService] Error evaluating ticket ${ticket.id}:`, error);

      // On error, safely ensure ticket does not get stuck in PROCESSING: move to OPEN
      const openTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.OPEN },
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return {
        ticket: openTicket,
        autoResolved: false,
      };
    }
  }

  /**
   * Enqueues ticket processing into the background queue (pg-boss).
   */
  static async enqueueProcessing(
    ticketId: string,
    options?: ProcessTicketOptions
  ): Promise<string | null> {
    return QueueService.enqueueTicketClassification(ticketId, options);
  }
}
