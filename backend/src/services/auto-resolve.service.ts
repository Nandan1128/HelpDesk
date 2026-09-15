import { Ticket, TicketStatus, SenderType, Role, User } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { AIService, AutoResolveEvaluationResult } from './ai.service.js';
import { QueueService } from './queue.service.js';
import { EmailService } from './email.service.js';

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
   * Retrieves or creates the dedicated AI support agent account.
   */
  static async getOrCreateAiAgent(): Promise<User> {
    const aiEmail = (process.env.AI_AGENT_EMAIL || 'ai@ticketai.local').toLowerCase().trim();
    const aiName = 'AI';

    let aiUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: aiEmail },
          { name: aiName, role: Role.AGENT, deletedAt: null },
        ],
      },
    });

    if (aiUser) {
      if (!aiUser.isActive || aiUser.deletedAt !== null) {
        aiUser = await prisma.user.update({
          where: { id: aiUser.id },
          data: { isActive: true, deletedAt: null },
        });
      }
      return aiUser;
    }

    try {
      aiUser = await prisma.user.create({
        data: {
          name: aiName,
          email: aiEmail,
          role: Role.AGENT,
          isActive: true,
          emailVerified: true,
        },
      });
      return aiUser;
    } catch {
      // Gracefully handle race condition if another process concurrently created the AI agent
      aiUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: aiEmail },
            { name: aiName, role: Role.AGENT },
          ],
        },
      });

      if (aiUser) {
        return aiUser;
      }
      throw new Error('Failed to retrieve or create AI agent');
    }
  }

  /**
   * Processes a ticket upon arrival through the AI auto-resolution state machine:
   * 1. Ticket starts in NEW state (assigned to the AI agent).
   * 2. Moves ticket to PROCESSING state while AI evaluates against knowledge-base.md.
   * 3. If AI can resolve based on the knowledge base (and no escalation rule is triggered):
   *    - Appends a SYSTEM reply message with the grounded solution.
   *    - Transitions ticket status to RESOLVED (remains assigned to AI agent).
   * 4. If AI cannot resolve (or Section 10 escalation triggered / missing key / error):
   *    - Unassigns ticket from the AI agent (assignedToId: null).
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
    const aiAgent = await AutoResolveService.getOrCreateAiAgent();

    const processingTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.PROCESSING,
        assignedToId: ticket.assignedToId || aiAgent.id,
      },
    });

    const apiKey = options?.apiKey || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    // Graceful fallback if GEMINI_API_KEY is not configured (e.g. CI, test env)
    if (!apiKey) {
      console.warn(
        `[AutoResolveService] GEMINI_API_KEY is not configured. Moving ticket #${ticket.ticketNumber} from PROCESSING to OPEN and unassigning AI.`
      );
      const openTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.OPEN,
          assignedToId: null, // Unassign from AI agent
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
        // Find latest customer message ID for email client threading (In-Reply-To)
        const lastCustomerMessage = [...ticket.messages]
          .reverse()
          .find((m) => m.senderType === SenderType.CUSTOMER && m.messageIdHeader);
        const inReplyToMessageId =
          lastCustomerMessage?.messageIdHeader ||
          ticket.messages[ticket.messages.length - 1]?.messageIdHeader ||
          undefined;

        const [newMessage, resolvedTicket] = await prisma.$transaction([
          prisma.message.create({
            data: {
              ticketId: ticket.id,
              senderType: SenderType.SYSTEM,
              senderName: 'TicketAI Support',
              senderEmail: env.SUPPORT_EMAIL,
              body: evaluation.resolutionMessage,
              inReplyToHeader: inReplyToMessageId || null,
            },
          }),
          prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              status: TicketStatus.RESOLVED,
              category: evaluation.category,
              priority: evaluation.priority,
              assignedToId: aiAgent.id,
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

        // Deliver AI Auto-Resolution reply to customer's email inbox
        if (ticket.customerEmail) {
          try {
            const emailResult = await EmailService.sendTicketReplyNotification({
              to: ticket.customerEmail,
              ticketNumber: resolvedTicket.ticketNumber,
              title: resolvedTicket.subject,
              senderName: 'TicketAI Support',
              messageContent: evaluation.resolutionMessage,
              inReplyToMessageId,
            });

            if (emailResult.success && emailResult.messageId) {
              await prisma.message.update({
                where: { id: newMessage.id },
                data: { messageIdHeader: emailResult.messageId },
              });
            }
          } catch (emailErr) {
            console.warn('⚠️ [AutoResolveService] Could not send auto-resolve email to customer:', emailErr);
          }
        }

        console.log(
          `[AutoResolveService] Ticket #${resolvedTicket.ticketNumber} AUTO-RESOLVED by AI. Category: ${resolvedTicket.category}, Priority: ${resolvedTicket.priority}, Assigned to AI Agent (${aiAgent.name}). Email sent to ${ticket.customerEmail}.`
        );

        return {
          ticket: resolvedTicket,
          evaluation,
          autoResolved: true,
        };
      }

      // Branch B: AI could not auto-resolve or escalated -> Transition to OPEN and unassign AI for human agent
      const openTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.OPEN,
          category: evaluation.category,
          priority: evaluation.priority,
          assignedToId: null, // Unassign from AI agent
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
        `[AutoResolveService] Ticket #${openTicket.ticketNumber} moved to OPEN (Escalated / Needs Human Agent). Unassigned from AI. Category: ${openTicket.category}, Priority: ${openTicket.priority}.`
      );

      return {
        ticket: openTicket,
        evaluation,
        autoResolved: false,
      };
    } catch (error) {
      console.error(`[AutoResolveService] Error evaluating ticket ${ticket.id}:`, error);

      // On error, safely ensure ticket does not get stuck in PROCESSING: move to OPEN and unassign from AI
      const openTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.OPEN,
          assignedToId: null, // Unassign from AI agent
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
