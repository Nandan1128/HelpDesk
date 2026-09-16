import { Router, Response } from 'express';
import { Prisma, Role, TicketStatus, TicketCategory, Priority, SenderType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AIService } from '../services/ai.service.js';
import { TicketClassifierService } from '../services/ticket-classifier.service.js';
import { AutoResolveService } from '../services/auto-resolve.service.js';
import { EmailService } from '../services/email.service.js';

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

    // Status filter: Never show tickets being resolved by AI (NEW or PROCESSING) on the ticket list
    if (statusFilter && ['OPEN', 'RESOLVED', 'CLOSED'].includes(statusFilter)) {
      where.status = statusFilter as TicketStatus;
    } else {
      where.status = { notIn: [TicketStatus.NEW, TicketStatus.PROCESSING] };
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

    const openCount = statusCounts[TicketStatus.OPEN] || 0;
    const resolvedCount = statusCounts[TicketStatus.RESOLVED] || 0;
    const closedCount = statusCounts[TicketStatus.CLOSED] || 0;
    const totalActionableTickets = openCount + resolvedCount + closedCount;

    const metrics = {
      total: totalActionableTickets,
      open: openCount,
      resolved: resolvedCount,
      closed: closedCount,
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
        error: parseResult.error.issues[0]?.message || 'Invalid ticket data',
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

    let finalAssignedToId = assignedToId;
    if (finalAssignedToId) {
      const agent = await prisma.user.findFirst({
        where: { id: finalAssignedToId, deletedAt: null },
      });
      if (!agent) {
        return res.status(400).json({ error: 'Assigned agent not found or inactive' });
      }
    } else if (finalAssignedToId === undefined || status === TicketStatus.NEW) {
      // When a new ticket arrives without explicit assignment, assign it to the AI agent for auto-resolutions
      const aiAgent = await AutoResolveService.getOrCreateAiAgent();
      finalAssignedToId = aiAgent.id;
    }

    const newTicket = await prisma.ticket.create({
      data: {
        subject,
        customerEmail: customerEmail.toLowerCase().trim(),
        customerName: customerName || customerEmail.split('@')[0],
        status,
        category: category || TicketCategory.GENERAL_QUESTION,
        priority: priority || Priority.MEDIUM,
        assignedToId: finalAssignedToId,
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

    // If status is NEW or autoClassify is true and category or priority was not explicitly specified,
    // trigger background Gemini AI processing/classification via pg-boss
    if (status === TicketStatus.NEW || (autoClassify && (!category || !priority))) {
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
    const aiEmail = (process.env.AI_AGENT_EMAIL || 'ai@ticketai.local').toLowerCase().trim();
    const agents = await prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        NOT: [
          { email: aiEmail },
          { name: 'AI', role: Role.AGENT },
        ],
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
 * Helper to format duration in milliseconds to human-readable string.
 */
export function formatResolutionDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.round(ms / (1000 * 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

/**
 * GET /api/tickets/dashboard
 * Aggregates support operations metrics, resolution statistics,
 * category distribution, and recent activity.
 */
router.get('/dashboard', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const past30DaysStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0));

    const [statusGroups, categoryGroups, totalTickets, aiResolvedTicketsCount, resolvedTickets, ticketsPast30Days] = await Promise.all([
      prisma.ticket.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({
        by: ['category'],
        _count: { _all: true },
      }),
      prisma.ticket.count(),
      prisma.ticket.count({
        where: {
          status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
          OR: [
            { messages: { some: { senderType: SenderType.SYSTEM } } },
            { aiSummary: { contains: 'Auto-resolved' } },
          ],
        },
      }),
      prisma.ticket.findMany({
        where: {
          status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          aiSummary: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              createdAt: true,
              senderType: true,
            },
          },
        },
      }),
      prisma.ticket.findMany({
        where: {
          createdAt: {
            gte: past30DaysStart,
          },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    // Build status breakdown
    const statusCounts = statusGroups.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {});

    const openTickets = statusCounts[TicketStatus.OPEN] || 0;
    const resolvedTicketsCount = statusCounts[TicketStatus.RESOLVED] || 0;
    const closedTicketsCount = statusCounts[TicketStatus.CLOSED] || 0;
    const newTicketsCount = statusCounts[TicketStatus.NEW] || 0;
    const processingTicketsCount = statusCounts[TicketStatus.PROCESSING] || 0;
    const totalResolvedAndClosed = resolvedTicketsCount + closedTicketsCount;

    // Calculate Average Resolution Time
    let totalResolutionMs = 0;
    let aiResolutionMs = 0;
    let aiCount = 0;
    let humanResolutionMs = 0;
    let humanCount = 0;

    for (const t of resolvedTickets) {
      const resolvedTime = t.messages[0]?.createdAt || t.updatedAt;
      const duration = Math.max(0, new Date(resolvedTime).getTime() - new Date(t.createdAt).getTime());
      totalResolutionMs += duration;

      const isAi =
        t.messages[0]?.senderType === SenderType.SYSTEM ||
        (t.aiSummary?.includes('Auto-resolved') ?? false);

      if (isAi) {
        aiResolutionMs += duration;
        aiCount++;
      } else {
        humanResolutionMs += duration;
        humanCount++;
      }
    }

    const avgResolutionTimeMs =
      resolvedTickets.length > 0 ? Math.round(totalResolutionMs / resolvedTickets.length) : 0;
    const aiAvgResolutionTimeMs =
      aiCount > 0 ? Math.round(aiResolutionMs / aiCount) : 0;
    const humanAvgResolutionTimeMs =
      humanCount > 0 ? Math.round(humanResolutionMs / humanCount) : 0;

    // Calculate % of tickets resolved by AI
    const aiResolvedPercentage =
      totalTickets > 0 ? Number(((aiResolvedTicketsCount / totalTickets) * 100).toFixed(1)) : 0;
    const aiResolvedRateOfResolved =
      totalResolvedAndClosed > 0
        ? Number(((aiResolvedTicketsCount / totalResolvedAndClosed) * 100).toFixed(1))
        : 0;

    // Category breakdown
    const categoryCounts = categoryGroups.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.category] = curr._count._all;
      return acc;
    }, {});

    const allCategories = [
      TicketCategory.GENERAL_QUESTION,
      TicketCategory.TECHNICAL_QUESTION,
      TicketCategory.REFUND_REQUEST,
    ];

    const categoryBreakdown = allCategories.map((cat) => {
      const count = categoryCounts[cat] || 0;
      const percentage =
        totalTickets > 0 ? Number(((count / totalTickets) * 100).toFixed(1)) : 0;
      return {
        category: cat,
        count,
        percentage,
      };
    });

    // 5 Recent Tickets
    const recentTicketsRaw = await prisma.ticket.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        customerName: true,
        customerEmail: true,
        status: true,
        category: true,
        priority: true,
        aiSummary: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          where: { senderType: SenderType.SYSTEM },
          select: { id: true },
          take: 1,
        },
      },
    });

    const recentTickets = recentTicketsRaw.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      customerName: t.customerName,
      customerEmail: t.customerEmail,
      status: t.status,
      category: t.category,
      priority: t.priority,
      autoResolved: t.messages.length > 0 || (t.aiSummary?.includes('Auto-resolved') ?? false),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    // 30-day ticket counts aggregation (past 30 days chronologically)
    const dateCounts = new Map<string, number>();
    for (const t of ticketsPast30Days) {
      const dateKey = new Date(t.createdAt).toISOString().split('T')[0];
      dateCounts.set(dateKey, (dateCounts.get(dateKey) || 0) + 1);
    }

    const ticketsPerDay: Array<{ date: string; formattedDate: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i, 0, 0, 0, 0));
      const dateKey = day.toISOString().split('T')[0];
      const count = dateCounts.get(dateKey) || 0;
      const formattedDate = day.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      ticketsPerDay.push({
        date: dateKey,
        formattedDate,
        count,
      });
    }

    return res.json({
      metrics: {
        totalTickets,
        openTickets,
        resolvedTickets: resolvedTicketsCount,
        closedTickets: closedTicketsCount,
        newTickets: newTicketsCount,
        processingTickets: processingTicketsCount,
        aiResolvedTickets: aiResolvedTicketsCount,
        aiResolvedPercentage,
        aiResolvedRateOfResolved,
        averageResolutionTimeMs: avgResolutionTimeMs,
        averageResolutionTimeFormatted: formatResolutionDuration(avgResolutionTimeMs),
        aiAverageResolutionTimeMs: aiAvgResolutionTimeMs,
        aiAverageResolutionTimeFormatted: formatResolutionDuration(aiAvgResolutionTimeMs),
        humanAverageResolutionTimeMs: humanAvgResolutionTimeMs,
        humanAverageResolutionTimeFormatted: formatResolutionDuration(humanAvgResolutionTimeMs),
      },
      categoryBreakdown,
      recentTickets,
      ticketsPerDay,
      dailyTickets: ticketsPerDay,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard metrics';
    console.error('[Dashboard Metrics Error]:', error);
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
        error: parseResult.error.issues[0]?.message || 'Invalid ticket update data',
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
        error: parseResult.error.issues[0]?.message || 'Invalid classification payload',
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
        error: parseResult.error.issues[0]?.message || 'ticketId is required',
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
        error: parseResult.error.issues[0]?.message || 'Draft reply text cannot be empty',
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
        error: parseResult.error.issues[0]?.message || 'Draft reply text cannot be empty',
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
        error: parseResult.error.issues[0]?.message || 'Invalid message data',
      });
    }

    const { body, status } = parseResult.data;

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const existingTicket = await prisma.ticket.findUnique({
      where,
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const user = req.user;

    // Find latest parent message ID for email client threading (In-Reply-To)
    const lastCustomerMessage = [...existingTicket.messages]
      .reverse()
      .find((m) => m.senderType === SenderType.CUSTOMER && m.messageIdHeader);
    const inReplyToMessageId =
      lastCustomerMessage?.messageIdHeader ||
      existingTicket.messages[existingTicket.messages.length - 1]?.messageIdHeader ||
      undefined;

    const [newMessage, updatedTicket] = await prisma.$transaction([
      prisma.message.create({
        data: {
          ticketId: existingTicket.id,
          senderType: SenderType.AGENT,
          senderEmail: user?.email || 'support@ticketai.local',
          senderName: user?.name || 'Support Agent',
          body,
          inReplyToHeader: inReplyToMessageId || null,
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

    // Send the reply directly to the customer's email with In-Reply-To threading
    if (existingTicket.customerEmail) {
      try {
        const emailResult = await EmailService.sendTicketReplyNotification({
          to: existingTicket.customerEmail,
          ticketNumber: existingTicket.ticketNumber,
          title: existingTicket.subject,
          senderName: user?.name || 'Support Agent',
          messageContent: body,
          inReplyToMessageId,
        });

        if (emailResult.success && emailResult.messageId) {
          // Persist the outgoing messageIdHeader for future threading
          await prisma.message.update({
            where: { id: newMessage.id },
            data: { messageIdHeader: emailResult.messageId },
          });
        }
      } catch (emailErr) {
        console.warn('⚠️ [TicketRoutes] Could not send reply email to customer:', emailErr);
      }
    }

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

/**
 * POST /api/tickets/:id/auto-resolve
 * Evaluates and processes a ticket against the knowledge base for auto-resolution.
 * Supports lookup by numeric ticketNumber or UUID.
 * Accessible to authenticated users.
 */
router.post('/:id/auto-resolve', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const isNumeric = /^\d+$/.test(id);
    const where: Prisma.TicketWhereUniqueInput = isNumeric
      ? { ticketNumber: parseInt(id, 10) }
      : { id };

    const ticket = await prisma.ticket.findUnique({ where });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const result = await AutoResolveService.processTicket(ticket.id);
    if (!result) {
      return res.status(500).json({ error: 'Failed to process auto-resolution' });
    }

    return res.json({
      success: true,
      ticket: result.ticket,
      evaluation: result.evaluation,
      autoResolved: result.autoResolved,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to auto-resolve ticket';
    console.error('[Auto-Resolve Route Error]:', error);
    return res.status(500).json({ error: message });
  }
});

export default router;
