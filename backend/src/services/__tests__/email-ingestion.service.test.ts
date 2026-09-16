import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { EmailIngestionService } from '../email-ingestion.service.js';
import { prisma } from '../../db/prisma.js';
import { TicketStatus, SenderType } from '@prisma/client';
import { QueueService } from '../queue.service.js';

describe('EmailIngestionService - Unit & Integration Tests', () => {
  const createdTicketIds: string[] = [];

  afterAll(async () => {
    // Clean up any tickets created during tests
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

  describe('Subject Parsing & Body Cleaning Helpers', () => {
    test('extractTicketNumberFromSubject extracts ticket number correctly', () => {
      expect(EmailIngestionService.extractTicketNumberFromSubject('[#102] Billing question')).toBe(102);
      expect(EmailIngestionService.extractTicketNumberFromSubject('Re: [555] Help')).toBe(555);
      expect(EmailIngestionService.extractTicketNumberFromSubject('Ticket #42 - Critical error')).toBe(42);
      expect(EmailIngestionService.extractTicketNumberFromSubject('Case 888: Login problem')).toBe(888);
      expect(EmailIngestionService.extractTicketNumberFromSubject('General inquiry without ticket id')).toBeNull();
      expect(EmailIngestionService.extractTicketNumberFromSubject('')).toBeNull();
    });

    test('cleanBody extracts text and strips HTML properly', () => {
      expect(EmailIngestionService.cleanBody('Hello world', undefined)).toBe('Hello world');
      expect(
        EmailIngestionService.cleanBody(
          undefined,
          '<div><p>Hello <strong>support</strong>!</p><script>alert("test")</script></div>'
        )
      ).toBe('Hello support !');
      expect(EmailIngestionService.cleanBody('  trimmed text  ', '<p>ignored</p>')).toBe('trimmed text');
    });

    test('cleanBody and stripQuotedReply remove quoted thread history from email replies', () => {
      const gmailReply = `Test follow up massage

On Tue, Sep 15, 2026, 9:25 PM Admin <support.nandangogari@gmail.com> wrote:

> Support Reply: Ticket #327
>
> *Admin*:
> this is agent from support team and this follow up massage
>
> You can reply directly to this email to respond.
`;

      expect(EmailIngestionService.cleanBody(gmailReply, undefined)).toBe('Test follow up massage');

      const outlookReply = `I need help with this issue.

-----Original Message-----
From: support@ticketai.local
Sent: Monday, September 14, 2026 10:00 AM
To: customer@example.com
Subject: Support Ticket #100
`;

      expect(EmailIngestionService.cleanBody(outlookReply, undefined)).toBe('I need help with this issue.');
    });
  });

  describe('Validation Rules', () => {
    test('rejects payload with invalid sender email', async () => {
      expect(
        EmailIngestionService.processInboundEmail({
          from: 'not-an-email',
          to: 'support@ticketai.local',
          subject: 'Test subject',
          body: 'Test body',
        })
      ).rejects.toThrow();
    });

    test('rejects payload without body or html', async () => {
      expect(
        EmailIngestionService.processInboundEmail({
          from: 'valid@example.com',
          to: 'support@ticketai.local',
          subject: 'Test subject',
          body: '',
          html: '',
        })
      ).rejects.toThrow();
    });

    test('rejects payload with empty subject', async () => {
      expect(
        EmailIngestionService.processInboundEmail({
          from: 'valid@example.com',
          to: 'support@ticketai.local',
          subject: '   ',
          body: 'Some content',
        })
      ).rejects.toThrow();
    });
  });

  describe('Ticket Ingestion & Smart Threading', () => {
    test('creates a brand new ticket when no thread match exists', async () => {
      const uniqueSuffix = Date.now();
      const senderEmail = `customer_${uniqueSuffix}@example.com`;
      const subject = `Urgent login assistance ${uniqueSuffix}`;
      const messageId = `<msg-${uniqueSuffix}@mail.example.com>`;

      const result = await EmailIngestionService.processInboundEmail({
        from: senderEmail,
        fromName: 'Test Customer',
        to: 'support@ticketai.local',
        subject,
        body: 'Hello, I cannot access my account dashboard.',
        messageId,
      });

      expect(result.action).toBe('created_ticket');
      expect(result.ticket.id).toBeDefined();
      createdTicketIds.push(result.ticket.id);

      expect(result.ticket.subject).toBe(subject);
      expect(result.ticket.customerEmail).toBe(senderEmail);
      expect(result.ticket.customerName).toBe('Test Customer');
      expect(result.ticket.status).toBe(TicketStatus.NEW);
      expect(result.ticket.ticketNumber).toBeGreaterThan(0);
      expect(result.ticket.assignedToId).toBeDefined();
      expect(result.ticket.assignedToId).not.toBeNull();

      // Check initial message
      expect(result.message.ticketId).toBe(result.ticket.id);
      expect(result.message.senderType).toBe(SenderType.CUSTOMER);
      expect(result.message.body).toBe('Hello, I cannot access my account dashboard.');
      expect(result.message.messageIdHeader).toBe(messageId);
    });

    test('appends message to existing ticket via In-Reply-To header', async () => {
      const uniqueSuffix = Date.now() + 1;
      const initialMessageId = `<initial-${uniqueSuffix}@mail.example.com>`;

      // Create initial ticket
      const initialResult = await EmailIngestionService.processInboundEmail({
        from: `customer_${uniqueSuffix}@example.com`,
        fromName: 'Thread Customer',
        to: 'support@ticketai.local',
        subject: `Thread initial message ${uniqueSuffix}`,
        body: 'First message in conversation',
        messageId: initialMessageId,
      });

      createdTicketIds.push(initialResult.ticket.id);

      // Reply with inReplyTo matching initialMessageId
      const replyMessageId = `<reply-${uniqueSuffix}@mail.example.com>`;
      const replyResult = await EmailIngestionService.processInboundEmail({
        from: `customer_${uniqueSuffix}@example.com`,
        to: 'support@ticketai.local',
        subject: `Re: Thread initial message ${uniqueSuffix}`,
        body: 'This is a customer follow-up reply',
        messageId: replyMessageId,
        inReplyTo: initialMessageId,
      });

      expect(replyResult.action).toBe('appended_message');
      expect(replyResult.ticket.id).toBe(initialResult.ticket.id);
      expect(replyResult.message.ticketId).toBe(initialResult.ticket.id);
      expect(replyResult.message.body).toBe('This is a customer follow-up reply');
      expect(replyResult.message.inReplyToHeader).toBe(initialMessageId);
      expect(replyResult.isReopened).toBe(false);
    });

    test('appends message to existing ticket via [#ticketNumber] in subject', async () => {
      const uniqueSuffix = Date.now() + 2;

      // Create initial ticket
      const initialResult = await EmailIngestionService.processInboundEmail({
        from: `customer_${uniqueSuffix}@example.com`,
        to: 'support@ticketai.local',
        subject: `Checkout inquiry ${uniqueSuffix}`,
        body: 'Initial checkout error message',
      });

      createdTicketIds.push(initialResult.ticket.id);
      const ticketNum = initialResult.ticket.ticketNumber;

      // Reply with subject containing [#ticketNumber]
      const replyResult = await EmailIngestionService.processInboundEmail({
        from: `customer_${uniqueSuffix}@example.com`,
        to: 'support@ticketai.local',
        subject: `Re: Checkout inquiry ${uniqueSuffix} [#${ticketNum}]`,
        body: 'Here is additional information regarding the checkout error',
      });

      expect(replyResult.action).toBe('appended_message');
      expect(replyResult.ticket.id).toBe(initialResult.ticket.id);
      expect(replyResult.message.ticketId).toBe(initialResult.ticket.id);
      expect(replyResult.message.body).toBe(
        'Here is additional information regarding the checkout error'
      );
    });

    test('reopens a RESOLVED or CLOSED ticket when customer sends a reply', async () => {
      const uniqueSuffix = Date.now() + 3;

      // Create ticket and resolve it
      const initialResult = await EmailIngestionService.processInboundEmail({
        from: `reopen_${uniqueSuffix}@example.com`,
        to: 'support@ticketai.local',
        subject: `Issue to be resolved ${uniqueSuffix}`,
        body: 'Original problem statement',
      });

      createdTicketIds.push(initialResult.ticket.id);

      await prisma.ticket.update({
        where: { id: initialResult.ticket.id },
        data: { status: TicketStatus.RESOLVED },
      });

      // Customer replies to resolved ticket
      const replyResult = await EmailIngestionService.processInboundEmail({
        from: `reopen_${uniqueSuffix}@example.com`,
        to: 'support@ticketai.local',
        subject: `Re: Issue to be resolved ${uniqueSuffix} [#${initialResult.ticket.ticketNumber}]`,
        body: 'The problem actually came back! Please reopen.',
      });

      expect(replyResult.action).toBe('appended_message');
      expect(replyResult.ticket.status).toBe(TicketStatus.OPEN);
      expect(replyResult.isReopened).toBe(true);

      // Verify in database
      const dbTicket = await prisma.ticket.findUnique({
        where: { id: initialResult.ticket.id },
      });
      expect(dbTicket?.status).toBe(TicketStatus.OPEN);
    });

    test('reopens a RESOLVED ticket even when subject lacks [#tag] using Resend In-Reply-To headers', async () => {
      const uniqueSuffix = Date.now() + 4;
      const resendMessageId = `resend-uuid-${uniqueSuffix}-abc123xyz`;

      // 1. Initial customer ticket
      const initialResult = await EmailIngestionService.processInboundEmail({
        from: `customer_${uniqueSuffix}@example.com`,
        to: 'support@ticketai.local',
        subject: `Password reset query ${uniqueSuffix}`,
        body: 'How do I reset my password?',
      });

      createdTicketIds.push(initialResult.ticket.id);

      // 2. System auto-resolves and saves outbound Resend message ID
      await prisma.message.create({
        data: {
          ticketId: initialResult.ticket.id,
          senderType: SenderType.SYSTEM,
          senderName: 'TicketAI Support',
          senderEmail: 'onboarding@resend.dev',
          body: 'Here are the steps to reset your password.',
          messageIdHeader: resendMessageId,
        },
      });

      await prisma.ticket.update({
        where: { id: initialResult.ticket.id },
        data: { status: TicketStatus.RESOLVED },
      });

      // 3. Customer replies in Gmail (Gmail sends angle brackets and domain suffix on in-reply-to)
      const replyResult = await EmailIngestionService.processInboundEmail({
        from: `customer_${uniqueSuffix}@example.com`,
        to: 'support.nandangogari@gmail.com',
        subject: `Re: Password reset query ${uniqueSuffix}`, // No [#ticketNumber] tag!
        body: 'Thanks, but the reset link is not working for me.',
        messageId: `<gmail-reply-${uniqueSuffix}@mail.gmail.com>`,
        inReplyTo: `<${resendMessageId}@resend.dev>`,
        references: `<${resendMessageId}@resend.dev>`,
      });

      expect(replyResult.action).toBe('appended_message');
      expect(replyResult.ticket.id).toBe(initialResult.ticket.id);
      expect(replyResult.ticket.status).toBe(TicketStatus.OPEN);
      expect(replyResult.isReopened).toBe(true);
      expect(replyResult.message.body).toBe('Thanks, but the reset link is not working for me.');

      // Verify in DB that the resolved ticket was reopened to OPEN
      const dbTicket = await prisma.ticket.findUnique({
        where: { id: initialResult.ticket.id },
      });
      expect(dbTicket?.status).toBe(TicketStatus.OPEN);
    });

    test('returns immediately without blocking caller when ingesting email', async () => {
      const uniqueSuffix = Date.now();
      const startTime = Date.now();

      const result = await EmailIngestionService.processInboundEmail({
        from: `nonblocking_${uniqueSuffix}@example.com`,
        to: 'support@ticketai.local',
        subject: `Performance test ${uniqueSuffix}`,
        body: 'Testing non-blocking ticket creation and classification.',
      });

      const elapsedMs = Date.now() - startTime;
      expect(result.action).toBe('created_ticket');
      expect(result.ticket.id).toBeDefined();
      createdTicketIds.push(result.ticket.id);

      // Email ingestion response must be non-blocking and return fast (well under 1000ms)
      expect(elapsedMs).toBeLessThan(1000);
    });
  });
});
