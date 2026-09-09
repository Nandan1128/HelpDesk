import { Router, Response } from 'express';
import { Prisma, TicketStatus, TicketCategory, Priority, SenderType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AIService } from '../services/ai.service.js';
import { TicketClassifierService } from '../services/ticket-classifier.service.js';

const router = Router();

/**
 * GET /api/tickets
 * Lists tickets with sorting (default: newest first), multi-criteria filtering, search, and metrics.
 * Accessible to authenticated users (ADMIN and AGENT).
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      q,
      status,
      priority,
      category,
      assignedTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '10',
    } = req.query;

    const searchTerm = (typeof search === 'string' ? search : typeof q === 'string' ? q : '')?.trim();
    const statusFilter = typeof status === 'string' ? status.toUpperCase() : undefined;
    const priorityFilter = typeof priority === 'string' ? priority.toUpperCase() : undefined;
    const categoryFilter = typeof category === 'string' ? category.toUpperCase() : undefined;
    const assignedToFilter = typeof assignedTo === 'string' ? assignedTo.trim() : undefined;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.TicketWhereInput = {};

    // Search filter across subject, customer email, customer name, or ticketNumber
    if (searchTerm) {
      const orConditions: Prisma.TicketWhereInput[] = [
        { subject: { contains: searchTerm, mode: 'insensitive' } },
        { customerEmail: { contains: searchTerm, mode: 'insensitive' } },
        { customerName: { contains: searchTerm, mode: 'insensitive' } },
      ];

      // Check if search query matches a ticket number (e.g. "123" or "#123")
      const parsedNumberMatch = searchTerm.match(/^#?(\d+)$/);
      if (parsedNumberMatch) {
        const parsedNum = parseInt(parsedNumberMatch[1], 10);
        if (!isNaN(parsedNum)) {
          orConditions.push({ ticketNumber: parsedNum });
        }
      }

      where.OR = orConditions;
    }

    // Status filter
    if (statusFilter && statusFilter !== 'ALL') {
      if (['OPEN', 'RESOLVED', 'CLOSED'].includes(statusFilter)) {
        where.status = statusFilter as TicketStatus;
      }
    }

    // Priority filter
    if (priorityFilter && priorityFilter !== 'ALL') {
      if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priorityFilter)) {
        where.priority = priorityFilter as Priority;
      }
    }

    // Category filter
    if (categoryFilter && categoryFilter !== 'ALL') {
      if (['GENERAL_QUESTION', 'TECHNICAL_QUESTION', 'REFUND_REQUEST'].includes(categoryFilter)) {
        where.category = categoryFilter as TicketCategory;
      }
    }

    // Assignment filter
    if (assignedToFilter && assignedToFilter !== 'ALL') {
      if (assignedToFilter.toUpperCase() === 'UNASSIGNED') {
        where.assignedToId = null;
      } else {
        where.assignedToId = assignedToFilter;
      }
    }

    // Sorting: default to newest first (createdAt: desc)
    const validSortFields = ['createdAt', 'updatedAt', 'ticketNumber', 'priority', 'status', 'subject', 'category'];
    const sortField = validSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
    const orderDirection: Prisma.SortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [tickets, total, statusGroups, unassignedCount, highOrUrgentCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: {
          [sortField]: orderDirection,
        },
        skip,
        take: limitNum,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
      prisma.ticket.count({ where }),
      prisma.ticket.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      prisma.ticket.count({
        where: { assignedToId: null },
      }),
      prisma.ticket.count({
        where: {
          status: TicketStatus.OPEN,
          priority: { in: [Priority.HIGH, Priority.URGENT] },
        },
      }),
    ]);

    // Build metrics summary
    const statusCounts = statusGroups.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {});

    const totalAllTickets = Object.values(statusCounts).reduce((sum, val) => sum + val, 0);

    const metrics = {
      total: totalAllTickets,
      open: statusCounts[TicketStatus.OPEN] || 0,
      resolved: statusCounts[TicketStatus.RESOLVED] || 0,
      closed: statusCounts[TicketStatus.CLOSED] || 0,
      unassigned: unassignedCount,
      urgentOrHigh: highOrUrgentCount,
    };

    return res.json({
      tickets,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
      metrics,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tickets';
    console.error('[Ticket List Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets
 * Creates a new support ticket manually (by Admin or Agent).
 * Automatically triggers non-blocking Gemini AI classification if category or priority is not explicitly specified.
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const createTicketSchema = z.object({
      subject: z.string().trim().min(1, 'Ticket subject is required'),
      customerEmail: z.string().trim().email('Valid customer email is required'),
      customerName: z.string().trim().optional(),
      body: z.string().trim().optional(),
      status: z.nativeEnum(TicketStatus).optional().default(TicketStatus.OPEN),
      category: z.nativeEnum(TicketCategory).optional(),
      priority: z.nativeEnum(Priority).optional(),
      assignedToId: z.string().nullable().optional(),
      autoClassify: z.boolean().optional().default(true),
    });

    const parseResult = createTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'Invalid ticket data',
      });
    }

    const {
      subject,
      customerEmail,
      customerName,
      body,
      status,
      category,
      priority,
      assignedToId,
      autoClassify,
    } = parseResult.data;

    if (assignedToId) {
      const agent = await prisma.user.findFirst({
        where: { id: assignedToId, deletedAt: null },
      });
      if (!agent) {
        return res.status(400).json({ error: 'Assigned agent not found or inactive' });
      }
    }

    const newTicket = await prisma.ticket.create({
      data: {
        subject,
        customerEmail: customerEmail.toLowerCase().trim(),
        customerName: customerName || customerEmail.split('@')[0],
        status,
        category: category || TicketCategory.GENERAL_QUESTION,
        priority: priority || Priority.MEDIUM,
        assignedToId,
        ...(body
          ? {
              messages: {
                create: [
                  {
                    senderType: SenderType.CUSTOMER,
                    senderEmail: customerEmail.toLowerCase().trim(),
                    senderName: customerName || customerEmail.split('@')[0],
                    body,
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: true,
      },
    });

    // If autoClassify is true and category or priority was not explicitly specified,
    // trigger background Gemini AI classification via pg-boss
    if (autoClassify && (!category || !priority)) {
      await TicketClassifierService.enqueueClassification(newTicket.id);
    }

    return res.status(201).json({ ticket: newTicket });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create ticket';
    console.error('[Create Ticket Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/tickets/agents
 * Returns list of active agents and admins who can be assigned tickets.
 */
router.get('/agents', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.json({ agents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch agents';
    console.error('[Agents List Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/tickets/:id
 * Returns single ticket details with messages.
 * Supports lookup by numeric ticketNumber (e.g. 101) or UUID.
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const ticket = await prisma.ticket.findUnique({
      where,
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

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    return res.json({ ticket });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch ticket details';
    console.error('[Ticket Details Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/tickets/:id
 * Updates ticket metadata (status, priority, category, assignedToId).
 * Supports lookup by numeric ticketNumber or UUID.
 */
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const updateTicketSchema = z.object({
      status: z.nativeEnum(TicketStatus).optional(),
      priority: z.nativeEnum(Priority).optional(),
      category: z.nativeEnum(TicketCategory).optional(),
      assignedToId: z.string().nullable().optional(),
    });

    const parseResult = updateTicketSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'Invalid ticket update data',
      });
    }

    const { status, priority, category, assignedToId } = parseResult.data;

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const existingTicket = await prisma.ticket.findUnique({
      where,
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (assignedToId) {
      const agent = await prisma.user.findFirst({
        where: { id: assignedToId, deletedAt: null },
      });
      if (!agent) {
        return res.status(400).json({ error: 'Assigned agent not found or inactive' });
      }
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: existingTicket.id },
      data: {
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(category !== undefined && { category }),
        ...(assignedToId !== undefined && { assignedToId }),
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

    return res.json({ ticket: updatedTicket });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update ticket';
    console.error('[Update Ticket Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets/classify
 * Standalone endpoint to classify given subject and body (or ticketId) directly using Gemini.
 * Supports non-blocking queueing when async=true.
 */
router.post('/classify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const classifySchema = z.object({
      ticketId: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
      customerName: z.string().optional(),
      customerEmail: z.string().optional(),
      async: z.boolean().optional(),
    });

    const parseResult = classifySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'Invalid classification payload',
      });
    }

    const { ticketId, subject, body, customerName, customerEmail, async: isAsync } = parseResult.data;

    if (ticketId) {
      if (isAsync) {
        const jobId = await TicketClassifierService.enqueueClassification(ticketId);
        return res.status(202).json({
          success: true,
          message: 'Ticket classification queued in background via pg-boss',
          ticketId,
          jobId,
        });
      }

      const result = await TicketClassifierService.classifyTicket(ticketId);
      if (!result) {
        return res.status(500).json({
          error: 'Classification failed or GEMINI_API_KEY is not configured',
        });
      }

      return res.json({
        success: true,
        ticket: result.ticket,
        classification: result.classification,
      });
    }

    if (!subject && !body) {
      return res.status(400).json({
        error: 'Either ticketId or subject/body is required for classification',
      });
    }

    const classification = await AIService.classifyTicket({
      subject: subject || '',
      body: body || '',
      customerName,
      customerEmail,
    });

    return res.json({
      success: true,
      classification,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to classify ticket';
    console.error('[Classify Endpoint Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets/summarize
 * Standalone endpoint to summarize a ticket and conversation history using Gemini via Vercel AI SDK.
 */
router.post('/summarize', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const summarizeSchema = z.object({
      ticketId: z.string().min(1, 'ticketId is required'),
    });

    const parseResult = summarizeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'ticketId is required',
      });
    }

    const { ticketId } = parseResult.data;
    const isNumeric = /^\d+$/.test(ticketId);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(ticketId, 10) }
      : { id: ticketId };

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const summary = await AIService.summarizeTicket({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      customerName: ticket.customerName,
      customerEmail: ticket.customerEmail,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      messages: ticket.messages,
    });

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        aiSummary: summary,
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return res.json({
      summary,
      ticket: updatedTicket,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to summarize ticket';
    console.error('[Summarize Ticket Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets/polish
 * Standalone endpoint to polish an agent draft response using Gemini via Vercel AI SDK.
 * Optionally accepts ticketId in payload to include ticket background context.
 */
router.post('/polish', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const polishSchema = z
      .object({
        draft: z.string().optional(),
        text: z.string().optional(),
        reply: z.string().optional(),
        ticketId: z.string().optional(),
      })
      .refine(
        (data) =>
          (data.draft && data.draft.trim().length > 0) ||
          (data.text && data.text.trim().length > 0) ||
          (data.reply && data.reply.trim().length > 0),
        {
          message: 'Draft reply text cannot be empty',
        }
      );

    const parseResult = polishSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'Draft reply text cannot be empty',
      });
    }

    const draft = (
      parseResult.data.draft ||
      parseResult.data.text ||
      parseResult.data.reply
    )!.trim();
    const { ticketId } = parseResult.data;

    let ticketContext;
    if (ticketId) {
      const isNumeric = /^\d+$/.test(ticketId);
      const where: Prisma.TicketWhereUniqueInput = isNumeric
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

      if (ticket) {
        ticketContext = {
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail,
          category: ticket.category,
          priority: ticket.priority,
          messages: ticket.messages,
        };
      }
    }

    const polishedReply = await AIService.polishReply({
      draft,
      ticketContext,
    });

    return res.json({
      polishedReply,
      text: polishedReply,
      originalDraft: draft,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to polish reply';
    console.error('[Polish Reply Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets/:id/polish
 * Polishes an agent's draft reply for a specific ticket using Gemini via Vercel AI SDK.
 * Supports lookup by numeric ticketNumber (e.g. 42) or UUID.
 */
router.post('/:id/polish', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const polishSchema = z
      .object({
        draft: z.string().optional(),
        text: z.string().optional(),
        reply: z.string().optional(),
      })
      .refine(
        (data) =>
          (data.draft && data.draft.trim().length > 0) ||
          (data.text && data.text.trim().length > 0) ||
          (data.reply && data.reply.trim().length > 0),
        {
          message: 'Draft reply text cannot be empty',
        }
      );

    const parseResult = polishSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'Draft reply text cannot be empty',
      });
    }

    const draft = (
      parseResult.data.draft ||
      parseResult.data.text ||
      parseResult.data.reply
    )!.trim();

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 10,
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const polishedReply = await AIService.polishReply({
      draft,
      ticketContext: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        category: ticket.category,
        priority: ticket.priority,
        messages: ticket.messages,
      },
    });

    return res.json({
      polishedReply,
      text: polishedReply,
      originalDraft: draft,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to polish reply';
    console.error('[Polish Reply Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets/:id/summarize
 * Generates or re-generates an AI summary for a ticket and its entire conversation history using Gemini via Vercel AI SDK.
 * Updates and persists `aiSummary` on the Ticket record.
 * Supports numeric ticketNumber (e.g. 42) or UUID.
 */
router.post('/:id/summarize', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const ticket = await prisma.ticket.findUnique({
      where,
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const summary = await AIService.summarizeTicket({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      customerName: ticket.customerName,
      customerEmail: ticket.customerEmail,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      messages: ticket.messages,
    });

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        aiSummary: summary,
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

    return res.json({
      summary,
      ticket: updatedTicket,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to summarize ticket';
    console.error('[Summarize Ticket Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets/:id/classify
 * Classifies a specific ticket using Google Gemini.
 * Supports non-blocking background queueing via ?async=true or body { async: true } / { nonBlocking: true }.
 * In default synchronous mode, awaits classification and returns updated ticket and metadata.
 */
router.post('/:id/classify', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isAsync =
      req.query.async === 'true' ||
      req.body?.async === true ||
      req.body?.nonBlocking === true;

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (isAsync) {
      // Trigger background classification via pg-boss
      const jobId = await TicketClassifierService.enqueueClassification(ticket.id);
      return res.status(202).json({
        success: true,
        message: 'Ticket classification queued in background via pg-boss',
        ticketId: ticket.id,
        jobId,
      });
    }

    const result = await TicketClassifierService.classifyTicket(ticket.id);
    if (!result) {
      return res.status(500).json({
        error: 'Classification failed or GEMINI_API_KEY is not configured',
      });
    }

    return res.json({
      success: true,
      ticket: result.ticket,
      classification: result.classification,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to classify ticket';
    console.error('[Classify Ticket Error]:', error);
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/tickets/:id/messages
 * Appends a message/reply to a ticket from an agent or admin.
 * Supports lookup by numeric ticketNumber or UUID.
 */
router.post('/:id/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const createMessageSchema = z.object({
      body: z.string().trim().min(1, 'Message body cannot be empty'),
      status: z.nativeEnum(TicketStatus).optional(),
    });

    const parseResult = createMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.error.errors[0]?.message || 'Invalid message data',
      });
    }

    const { body, status } = parseResult.data;

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const existingTicket = await prisma.ticket.findUnique({
      where,
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const user = req.user;
    const [newMessage, updatedTicket] = await prisma.$transaction([
      prisma.message.create({
        data: {
          ticketId: existingTicket.id,
          senderType: SenderType.AGENT,
          senderEmail: user?.email || 'support@ticketai.local',
          senderName: user?.name || 'Support Agent',
          body,
        },
      }),
      prisma.ticket.update({
        where: { id: existingTicket.id },
        data: {
          updatedAt: new Date(),
          ...(status ? { status } : {}),
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
      }),
    ]);

    return res.status(201).json({
      message: newMessage,
      ticket: updatedTicket,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to post message';
    console.error('[Post Message Error]:', error);
    return res.status(500).json({ error: message });
  }
});

export default router;
