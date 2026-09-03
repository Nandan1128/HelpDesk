import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { EmailIngestionService } from '../services/email-ingestion.service.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * GET /api/emails/inbound/info
 * Returns configuration details about the inbound email webhook
 */
router.get('/inbound/info', (_req: Request, res: Response) => {
  res.json({
    status: 'active',
    supportEmail: env.SUPPORT_EMAIL,
    expectedPayload: {
      from: 'customer@example.com (required)',
      fromName: 'Customer Name (optional)',
      to: `${env.SUPPORT_EMAIL} (required)`,
      subject: 'Issue description [#ticketNumber] (required)',
      body: 'Plain text email body (required unless html provided)',
      html: 'HTML email content (optional)',
      messageId: '<unique-message-id@domain> (optional)',
      inReplyTo: '<parent-message-id@domain> (optional)',
    },
    threading: {
      inReplyToHeader: 'Matches parent message ID to append to thread',
      subjectTag: 'Extracts [#123] to append to ticket #123 and reopen if closed',
    },
  });
});

/**
 * POST /api/emails/inbound
 * Ingests an inbound support email and converts to new ticket or appends to existing thread
 */
router.post('/inbound', async (req: Request, res: Response) => {
  try {
    const result = await EmailIngestionService.processInboundEmail(req.body);
    const statusCode = result.action === 'created_ticket' ? 201 : 200;

    return res.status(statusCode).json({
      success: true,
      action: result.action,
      isReopened: result.isReopened ?? false,
      ticket: {
        id: result.ticket.id,
        ticketNumber: result.ticket.ticketNumber,
        subject: result.ticket.subject,
        status: result.ticket.status,
        category: result.ticket.category,
        priority: result.ticket.priority,
        customerEmail: result.ticket.customerEmail,
        customerName: result.ticket.customerName,
        createdAt: result.ticket.createdAt,
        updatedAt: result.ticket.updatedAt,
      },
      message: {
        id: result.message.id,
        ticketId: result.message.ticketId,
        senderType: result.message.senderType,
        senderEmail: result.message.senderEmail,
        senderName: result.message.senderName,
        body: result.message.body,
        messageIdHeader: result.message.messageIdHeader,
        inReplyToHeader: result.message.inReplyToHeader,
        createdAt: result.message.createdAt,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed for inbound email payload',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to process inbound email';
    console.error('[Email Ingestion Error]:', error);

    return res.status(500).json({
      error: errorMessage,
    });
  }
});

export default router;
