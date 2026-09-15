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
import { TicketClassifierService } from './ticket-classifier.service.js';
import { AutoResolveService } from './auto-resolve.service.js';

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
   * Strips quoted historical message threads from email replies (e.g. "On ... wrote:", Outlook headers, > quotes)
   */
  static stripQuotedReply(text: string): string {
    if (!text) return '';

    const patterns = [
      // 1. Gmail / iOS / Thunderbird: "On [Date], [Sender] wrote:" or "On [Date] at [Time], [Sender] wrote:"
      /\r?\n\s*On\s+.+?,\s*.+?\s+wrote:\s*[\r\n]/i,
      /\r?\n\s*On\s+[\s\S]+?wrote:\s*[\r\n]/i,
      // 2. Outlook format: "-----Original Message-----"
      /\r?\n\s*-+\s*Original Message\s*-+[\r\n]/i,
      // 3. Outlook header block: "From: ... Sent: ... To: ... Subject: ..."
      /\r?\n\s*From:\s*.+?\r?\n\s*(?:Sent|Date):\s*.+?\r?\n\s*To:\s*.+?/i,
      // 4. Underscore separator (Yahoo / Webmail)
      /\r?\n\s*_{10,}\s*[\r\n]/,
    ];

    let cleaned = text;

    for (const pattern of patterns) {
      const match = cleaned.search(pattern);
      if (match !== -1) {
        cleaned = cleaned.substring(0, match);
        break;
      }
    }

    // Strip any trailing block of lines starting with '>'
    const lines = cleaned.split(/\r?\n/);
    const resultLines: string[] = [];
    for (const line of lines) {
      if (line.trim().startsWith('>')) {
        break;
      }
      resultLines.push(line);
    }

    const trimmedResult = resultLines.join('\n').trim();
    return trimmedResult.length > 0 ? trimmedResult : text.trim();
  }

  /**
   * Cleans text body from plain text or strips HTML markup, removing quoted thread history.
   */
  static cleanBody(body?: string, html?: string): string {
    if (body && body.trim().length > 0) {
      return this.stripQuotedReply(body);
    }
    if (html && html.trim().length > 0) {
      const stripped = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
        .replace(/<div class="gmail_quote"[\s\S]*?<\/div>/gi, '')
        .replace(/<div class="gmail_extra"[\s\S]*?<\/div>/gi, '')
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
        return this.stripQuotedReply(stripped);
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

    // Branch B: Create brand new ticket with first customer message assigned to AI agent
    const aiAgent = await AutoResolveService.getOrCreateAiAgent();

    const newTicket = await prisma.ticket.create({
      data: {
        subject: data.subject.trim(),
        customerEmail: senderEmail,
        customerName: senderName,
        status: TicketStatus.NEW,
        category: TicketCategory.GENERAL_QUESTION,
        priority: Priority.MEDIUM,
        assignedToId: aiAgent.id,
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
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Automatically enqueue ticket classification using pg-boss in the background
    await TicketClassifierService.enqueueClassification(newTicket.id);

    return {
      action: 'created_ticket',
      ticket: newTicket,
      message: newTicket.messages[0],
    };
  }
}
