import { z } from 'zod';
import {
  Ticket,
  Message,
  TicketStatus,
  TicketCategory,
  Priority,
  SenderType,
} from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

export const inboundEmailSchema = z
  .object({
    from: z.string().trim().email('Valid sender email address is required'),
    fromName: z.string().trim().optional(),
    to: z.string().trim().min(1, 'Recipient address is required'),
    subject: z.string().trim().min(1, 'Email subject is required'),
    body: z.string().optional(),
    html: z.string().optional(),
    messageId: z.string().trim().optional(),
    inReplyTo: z.string().trim().optional(),
  })
  .refine(
    (data) => (data.body && data.body.trim().length > 0) || (data.html && data.html.trim().length > 0),
    {
      message: 'Either email body or html content must be provided',
      path: ['body'],
    }
  );

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;

export interface InboundEmailResult {
  action: 'created_ticket' | 'appended_message';
  ticket: Ticket;
  message: Message;
  isReopened?: boolean;
}

export class EmailIngestionService {
  /**
   * Extracts ticket number from subject line (e.g. [#123], [123], Ticket #123)
   */
  static extractTicketNumberFromSubject(subject: string): number | null {
    if (!subject) return null;

    const MAX_INT4 = 2147483647;

    // Pattern 1: [#123] or [123]
    const bracketMatch = subject.match(/\[#?(\d{1,9})\]/i);
    if (bracketMatch) {
      const num = parseInt(bracketMatch[1], 10);
      if (!isNaN(num) && num > 0 && num <= MAX_INT4) return num;
    }

    // Pattern 2: Ticket #123, Ticket 123, Case #123, Case 123, Issue #123
    const keywordMatch = subject.match(/\b(?:ticket|case)\s*#?\s*(\d{1,9})\b|\bissue\s*#\s*(\d{1,9})\b/i);
    if (keywordMatch) {
      const numStr = keywordMatch[1] || keywordMatch[2];
      if (numStr) {
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > 0 && num <= MAX_INT4) return num;
      }
    }

    return null;
  }

  /**
   * Cleans text body from plain text or strips HTML markup
   */
  static cleanBody(body?: string, html?: string): string {
    if (body && body.trim().length > 0) {
      return body.trim();
    }
    if (html && html.trim().length > 0) {
      const stripped = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();

      if (stripped.length > 0) {
        return stripped;
      }
    }
    return '';
  }

  /**
   * Processes an incoming email, matching existing ticket thread or creating a new ticket.
   */
  static async processInboundEmail(rawInput: unknown): Promise<InboundEmailResult> {
    const data = inboundEmailSchema.parse(rawInput);
    const cleanedBody = this.cleanBody(data.body, data.html);

    if (!cleanedBody) {
      throw new Error('Email body could not be extracted from the provided content');
    }

    const senderEmail = data.from.toLowerCase().trim();
    const senderName = data.fromName?.trim() || senderEmail.split('@')[0];

    // Log destination check
    const supportEmailLower = env.SUPPORT_EMAIL.toLowerCase();
    if (!data.to.toLowerCase().includes(supportEmailLower)) {
      console.warn(
        `[Email Ingestion] Email received for '${data.to}', expected '${env.SUPPORT_EMAIL}'. Processing ticket.`
      );
    }

    let existingTicket: Ticket | null = null;

    // Threading Step 1: Check In-Reply-To header against existing messages
    if (data.inReplyTo) {
      const parentMessage = await prisma.message.findFirst({
        where: { messageIdHeader: data.inReplyTo.trim() },
        include: { ticket: true },
      });

      if (parentMessage?.ticket) {
        existingTicket = parentMessage.ticket;
      }
    }

    // Threading Step 2: Fallback to subject line ticket number
    if (!existingTicket) {
      const ticketNumber = this.extractTicketNumberFromSubject(data.subject);
      if (ticketNumber) {
        const ticketFound = await prisma.ticket.findUnique({
          where: { ticketNumber },
        });

        if (ticketFound) {
          existingTicket = ticketFound;
        }
      }
    }

    // Branch A: Append customer message to existing ticket
    if (existingTicket) {
      const isClosedOrResolved =
        existingTicket.status === TicketStatus.RESOLVED ||
        existingTicket.status === TicketStatus.CLOSED;

      const [newMessage, updatedTicket] = await prisma.$transaction([
        prisma.message.create({
          data: {
            ticketId: existingTicket.id,
            senderType: SenderType.CUSTOMER,
            senderEmail,
            senderName,
            body: cleanedBody,
            messageIdHeader: data.messageId?.trim() || null,
            inReplyToHeader: data.inReplyTo?.trim() || null,
          },
        }),
        prisma.ticket.update({
          where: { id: existingTicket.id },
          data: {
            // Reopen ticket if it was resolved or closed
            status: isClosedOrResolved ? TicketStatus.OPEN : undefined,
            updatedAt: new Date(),
          },
        }),
      ]);

      return {
        action: 'appended_message',
        ticket: updatedTicket,
        message: newMessage,
        isReopened: isClosedOrResolved,
      };
    }

    // Branch B: Create brand new ticket with first customer message
    const newTicket = await prisma.ticket.create({
      data: {
        subject: data.subject.trim(),
        customerEmail: senderEmail,
        customerName: senderName,
        status: TicketStatus.OPEN,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.MEDIUM,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderEmail,
              senderName,
              body: cleanedBody,
              messageIdHeader: data.messageId?.trim() || null,
              inReplyToHeader: data.inReplyTo?.trim() || null,
            },
          ],
        },
      },
      include: {
        messages: true,
      },
    });

    return {
      action: 'created_ticket',
      ticket: newTicket,
      message: newTicket.messages[0],
    };
  }
}
