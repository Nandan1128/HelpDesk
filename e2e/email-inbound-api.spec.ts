import { test, expect } from '@playwright/test';
import { getTestPrismaClient } from './support/db';

const prisma = getTestPrismaClient();

async function setTicketStatus(ticketId: string, status: 'RESOLVED' | 'CLOSED') {
  return await prisma.ticket.update({
    where: { id: ticketId },
    data: { status },
  });
}

test.describe('Inbound Email Ingestion API (POST /api/emails/inbound)', () => {
  const createdTicketIds: string[] = [];

  test.afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.message.deleteMany({
        where: { ticketId: { in: createdTicketIds } },
      });
      await prisma.ticket.deleteMany({
        where: { id: { in: createdTicketIds } },
      });
    }
  });

  test('GET /api/emails/inbound/info returns configuration and payload documentation', async ({
    request,
  }) => {
    const res = await request.get('/api/emails/inbound/info');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('active');
    expect(body.supportEmail).toBeDefined();
    expect(body.expectedPayload).toBeDefined();
    expect(body.threading).toBeDefined();
  });

  test('POST /api/emails/inbound rejects invalid payload with 400 Bad Request', async ({
    request,
  }) => {
    const res = await request.post('/api/emails/inbound', {
      data: {
        from: 'invalid-email-address',
        to: 'support@ticketai.local',
        subject: '',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
  });

  test('POST /api/emails/inbound successfully creates a new ticket from incoming email', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `inbound_api_${timestamp}@example.com`;
    const subject = `Urgent login issue for user ${timestamp}`;

    const res = await request.post('/api/emails/inbound', {
      data: {
        from: customerEmail,
        fromName: 'Grace Hopper',
        to: 'support@ticketai.local',
        subject,
        body: 'Hello Support, I cannot access the dashboard after our organization upgrade.',
        messageId: `<inbound-${timestamp}@example.com>`,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.action).toBe('created_ticket');
    expect(body.ticket).toBeDefined();
    expect(body.ticket.id).toBeDefined();
    createdTicketIds.push(body.ticket.id);

    expect(body.ticket.subject).toBe(subject);
    expect(body.ticket.customerEmail).toBe(customerEmail);
    expect(body.ticket.customerName).toBe('Grace Hopper');
    expect(body.ticket.status).toBe('OPEN');
    expect(body.ticket.category).toBe('GENERAL_QUESTION');
    expect(body.ticket.priority).toBe('MEDIUM');
    expect(body.ticket.ticketNumber).toBeGreaterThan(0);

    expect(body.message).toBeDefined();
    expect(body.message.ticketId).toBe(body.ticket.id);
    expect(body.message.senderType).toBe('CUSTOMER');
    expect(body.message.senderEmail).toBe(customerEmail);
    expect(body.message.body).toContain('cannot access the dashboard');
  });

  test('POST /api/emails/inbound appends message to existing ticket using In-Reply-To header', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const parentMsgId = `<parent-${timestamp}@example.com>`;
    const customerEmail = `threading_${timestamp}@example.com`;

    // 1. Initial email creates ticket
    const initialRes = await request.post('/api/emails/inbound', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Payment inquiry ${timestamp}`,
        body: 'Initial payment inquiry message',
        messageId: parentMsgId,
      },
    });

    expect(initialRes.status()).toBe(201);
    const initialBody = await initialRes.json();
    const ticketId = initialBody.ticket.id;
    createdTicketIds.push(ticketId);

    // 2. Reply email with In-Reply-To
    const replyMsgId = `<reply-${timestamp}@example.com>`;
    const replyRes = await request.post('/api/emails/inbound', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Re: Payment inquiry ${timestamp}`,
        body: 'Here is the invoice number you requested: #INV-2026',
        messageId: replyMsgId,
        inReplyTo: parentMsgId,
      },
    });

    expect(replyRes.status()).toBe(200);
    const replyBody = await replyRes.json();

    expect(replyBody.success).toBe(true);
    expect(replyBody.action).toBe('appended_message');
    expect(replyBody.ticket.id).toBe(ticketId);
    expect(replyBody.message.ticketId).toBe(ticketId);
    expect(replyBody.message.body).toContain('#INV-2026');
    expect(replyBody.message.inReplyToHeader).toBe(parentMsgId);
  });

  test('POST /api/emails/inbound appends message and reopens a RESOLVED ticket using [#ticketNumber]', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `reopen_api_${timestamp}@example.com`;

    // 1. Initial email
    const initialRes = await request.post('/api/emails/inbound', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Feature problem report ${timestamp}`,
        body: 'Found a bug on reports page',
      },
    });

    expect(initialRes.status()).toBe(201);
    const initialBody = await initialRes.json();
    const ticketId = initialBody.ticket.id;
    const ticketNumber = initialBody.ticket.ticketNumber;
    createdTicketIds.push(ticketId);

    // 2. Set ticket to RESOLVED in database
    await setTicketStatus(ticketId, 'RESOLVED');

    // 3. Customer sends reply referencing ticket number in subject
    const replyRes = await request.post('/api/emails/inbound', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Re: Feature problem report ${timestamp} [#${ticketNumber}]`,
        body: 'The bug is still happening today. Reopening request.',
      },
    });

    expect(replyRes.status()).toBe(200);
    const replyBody = await replyRes.json();

    expect(replyBody.success).toBe(true);
    expect(replyBody.action).toBe('appended_message');
    expect(replyBody.isReopened).toBe(true);
    expect(replyBody.ticket.id).toBe(ticketId);
    expect(replyBody.ticket.status).toBe('OPEN');
    expect(replyBody.message.ticketId).toBe(ticketId);
    expect(replyBody.message.body).toContain('The bug is still happening today');
  });
});
