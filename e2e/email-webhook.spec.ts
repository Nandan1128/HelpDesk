import { test, expect } from '@playwright/test';
import { getTestPrismaClient } from './support/db';

const prisma = getTestPrismaClient();

test.describe('Inbound Email Webhook E2E Tests (POST /api/webhooks/email)', () => {
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

  test('GET /api/webhooks/email/info should return active webhook info and payload requirements', async ({
    request,
  }) => {
    const res = await request.get('/api/webhooks/email/info');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('active');
    expect(body.supportEmail).toBeDefined();
    expect(body.expectedPayload).toBeDefined();
    expect(body.expectedPayload.from).toContain('required');
    expect(body.expectedPayload.subject).toContain('required');
    expect(body.threading).toBeDefined();
  });

  test('POST /api/webhooks/email should reject invalid payloads with 400 Bad Request', async ({
    request,
  }) => {
    // 1. Invalid email
    const invalidEmailRes = await request.post('/api/webhooks/email', {
      data: {
        from: 'not-a-valid-email',
        to: 'support@ticketai.local',
        subject: 'Valid Subject',
        body: 'Valid Body',
      },
    });
    expect(invalidEmailRes.status()).toBe(400);
    const invalidEmailBody = await invalidEmailRes.json();
    expect(invalidEmailBody.error).toContain('Validation failed');

    // 2. Missing body and html
    const missingBodyRes = await request.post('/api/webhooks/email', {
      data: {
        from: 'customer@example.com',
        to: 'support@ticketai.local',
        subject: 'Valid Subject',
        body: '',
        html: '',
      },
    });
    expect(missingBodyRes.status()).toBe(400);

    // 3. Missing subject
    const missingSubjectRes = await request.post('/api/webhooks/email', {
      data: {
        from: 'customer@example.com',
        to: 'support@ticketai.local',
        subject: '   ',
        body: 'Valid message body',
      },
    });
    expect(missingSubjectRes.status()).toBe(400);
  });

  test('POST /api/webhooks/email should convert a new email into a ticket with status OPEN', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `webhook_customer_${timestamp}@example.com`;
    const customerName = 'Ada Lovelace';
    const subject = `Question regarding API integration ${timestamp}`;
    const bodyText = 'Hello Support Desk, how can I authenticate webhooks with HMAC?';
    const messageId = `<webhook-msg-${timestamp}@mail.example.com>`;

    const res = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        fromName: customerName,
        to: 'support@ticketai.local',
        subject,
        body: bodyText,
        messageId,
      },
    });

    expect(res.status()).toBe(201);
    const responseData = await res.json();

    expect(responseData.success).toBe(true);
    expect(responseData.action).toBe('created_ticket');

    // Verify ticket properties
    const ticket = responseData.ticket;
    expect(ticket).toBeDefined();
    expect(ticket.id).toBeDefined();
    createdTicketIds.push(ticket.id);

    expect(ticket.subject).toBe(subject);
    expect(ticket.customerEmail).toBe(customerEmail);
    expect(ticket.customerName).toBe(customerName);
    expect(ticket.status).toBe('OPEN');
    expect(ticket.category).toBe('GENERAL_QUESTION');
    expect(ticket.priority).toBe('MEDIUM');
    expect(ticket.ticketNumber).toBeGreaterThan(0);

    // Verify initial message properties
    const message = responseData.message;
    expect(message).toBeDefined();
    expect(message.ticketId).toBe(ticket.id);
    expect(message.senderType).toBe('CUSTOMER');
    expect(message.senderEmail).toBe(customerEmail);
    expect(message.senderName).toBe(customerName);
    expect(message.body).toBe(bodyText);
    expect(message.messageIdHeader).toBe(messageId);

    // Verify directly in test database
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: { messages: true },
    });
    expect(dbTicket).not.toBeNull();
    expect(dbTicket?.subject).toBe(subject);
    expect(dbTicket?.messages.length).toBe(1);
    expect(dbTicket?.messages[0].body).toBe(bodyText);
  });

  test('POST /api/webhooks/email should extract and sanitize HTML-only emails', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `html_only_${timestamp}@example.com`;
    const subject = `HTML formatted email ${timestamp}`;
    const rawHtml = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Urgent System Problem</h2>
        <p>Hello team, our <strong>production server</strong> is returning 502 errors.</p>
        <script>alert("malicious script should be removed")</script>
        <p>Please investigate ASAP.</p>
      </div>
    `;

    const res = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject,
        html: rawHtml,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    createdTicketIds.push(body.ticket.id);

    expect(body.message.body).toContain('Urgent System Problem');
    expect(body.message.body).toContain('production server is returning 502 errors');
    expect(body.message.body).not.toContain('<script>');
    expect(body.message.body).not.toContain('alert(');
  });

  test('POST /api/webhooks/email should append message to existing ticket using In-Reply-To header', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `reply_header_${timestamp}@example.com`;
    const initialMessageId = `<parent-webhook-${timestamp}@mail.example.com>`;

    // Step 1: Send initial email webhook
    const initialRes = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        fromName: 'Thread Tester',
        to: 'support@ticketai.local',
        subject: `Password reset query ${timestamp}`,
        body: 'I clicked the reset link but did not receive a code.',
        messageId: initialMessageId,
      },
    });

    expect(initialRes.status()).toBe(201);
    const initialBody = await initialRes.json();
    const ticketId = initialBody.ticket.id;
    createdTicketIds.push(ticketId);

    // Step 2: Send reply webhook with In-Reply-To matching initialMessageId
    const replyMessageId = `<reply-webhook-${timestamp}@mail.example.com>`;
    const replyBodyText = 'Update: I checked my spam folder and found the code!';

    const replyRes = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Re: Password reset query ${timestamp}`,
        body: replyBodyText,
        messageId: replyMessageId,
        inReplyTo: initialMessageId,
      },
    });

    expect(replyRes.status()).toBe(200);
    const replyData = await replyRes.json();

    expect(replyData.success).toBe(true);
    expect(replyData.action).toBe('appended_message');
    expect(replyData.ticket.id).toBe(ticketId);
    expect(replyData.message.ticketId).toBe(ticketId);
    expect(replyData.message.body).toBe(replyBodyText);
    expect(replyData.message.inReplyToHeader).toBe(initialMessageId);

    // Verify in database that the ticket now has 2 messages
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: true },
    });
    expect(dbTicket?.messages.length).toBe(2);
  });

  test('POST /api/webhooks/email should append message using [#ticketNumber] in subject line', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `subject_tag_${timestamp}@example.com`;

    // Step 1: Create initial ticket
    const initialRes = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Subscription renewal question ${timestamp}`,
        body: 'When is my next billing date?',
      },
    });

    expect(initialRes.status()).toBe(201);
    const initialBody = await initialRes.json();
    const ticketId = initialBody.ticket.id;
    const ticketNumber = initialBody.ticket.ticketNumber;
    createdTicketIds.push(ticketId);

    // Step 2: Customer replies without inReplyTo, but includes [#ticketNumber] in subject
    const replyRes = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Re: Subscription renewal question ${timestamp} [#${ticketNumber}]`,
        body: 'Also, can I pay via PayPal instead?',
      },
    });

    expect(replyRes.status()).toBe(200);
    const replyData = await replyRes.json();

    expect(replyData.success).toBe(true);
    expect(replyData.action).toBe('appended_message');
    expect(replyData.ticket.id).toBe(ticketId);
    expect(replyData.message.ticketId).toBe(ticketId);
    expect(replyData.message.body).toBe('Also, can I pay via PayPal instead?');

    // Confirm total messages
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: true },
    });
    expect(dbTicket?.messages.length).toBe(2);
  });

  test('POST /api/webhooks/email should automatically reopen a RESOLVED or CLOSED ticket on reply', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `reopen_test_${timestamp}@example.com`;

    // Step 1: Create initial ticket
    const initialRes = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Bug on checkout modal ${timestamp}`,
        body: 'Clicking submit spinner hangs forever.',
      },
    });

    expect(initialRes.status()).toBe(201);
    const initialBody = await initialRes.json();
    const ticketId = initialBody.ticket.id;
    const ticketNumber = initialBody.ticket.ticketNumber;
    createdTicketIds.push(ticketId);

    // Step 2: Mark ticket as RESOLVED in database
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'RESOLVED' },
    });

    // Step 3: Customer replies to the resolved ticket
    const replyRes = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Re: Bug on checkout modal ${timestamp} [#${ticketNumber}]`,
        body: 'It happened again on Safari! Please reopen this issue.',
      },
    });

    expect(replyRes.status()).toBe(200);
    const replyData = await replyRes.json();

    expect(replyData.success).toBe(true);
    expect(replyData.action).toBe('appended_message');
    expect(replyData.isReopened).toBe(true);
    expect(replyData.ticket.id).toBe(ticketId);
    expect(replyData.ticket.status).toBe('OPEN');

    // Step 4: Verify directly in test database
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    expect(dbTicket?.status).toBe('OPEN');
  });

  test('Full Conversation Lifecycle: Multi-turn email conversation via webhook', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const customerEmail = `lifecycle_webhook_${timestamp}@example.com`;
    const initialMsgId = `<lifecycle-turn1-${timestamp}@mail.example.com>`;

    // Turn 1: Customer creates ticket
    const turn1Res = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        fromName: 'Lifecycle User',
        to: 'support@ticketai.local',
        subject: `Multi-turn conversation inquiry ${timestamp}`,
        body: 'Turn 1: Initial question about billing.',
        messageId: initialMsgId,
      },
    });
    expect(turn1Res.status()).toBe(201);
    const turn1Data = await turn1Res.json();
    const ticketId = turn1Data.ticket.id;
    const ticketNumber = turn1Data.ticket.ticketNumber;
    createdTicketIds.push(ticketId);

    // Turn 2: Customer sends follow-up via In-Reply-To
    const turn2MsgId = `<lifecycle-turn2-${timestamp}@mail.example.com>`;
    const turn2Res = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Re: Multi-turn conversation inquiry ${timestamp}`,
        body: 'Turn 2: Follow-up with invoice attachment reference.',
        messageId: turn2MsgId,
        inReplyTo: initialMsgId,
      },
    });
    expect(turn2Res.status()).toBe(200);

    // Turn 3: Support marks ticket as CLOSED
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED' },
    });

    // Turn 4: Customer sends reply referencing ticket number in subject
    const turn4Res = await request.post('/api/webhooks/email', {
      data: {
        from: customerEmail,
        to: 'support@ticketai.local',
        subject: `Re: Multi-turn conversation inquiry ${timestamp} [#${ticketNumber}]`,
        body: 'Turn 4: Reopening request - invoice still incorrect.',
      },
    });
    expect(turn4Res.status()).toBe(200);
    const turn4Data = await turn4Res.json();
    expect(turn4Data.isReopened).toBe(true);
    expect(turn4Data.ticket.status).toBe('OPEN');

    // Final verification: 3 messages in database, status OPEN
    const finalTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    expect(finalTicket?.status).toBe('OPEN');
    expect(finalTicket?.messages.length).toBe(3);
    expect(finalTicket?.messages[0].body).toContain('Turn 1');
    expect(finalTicket?.messages[1].body).toContain('Turn 2');
    expect(finalTicket?.messages[2].body).toContain('Turn 4');
  });
});
