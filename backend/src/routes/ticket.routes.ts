import { Router, Response } from 'express';
import { Prisma, TicketStatus, TicketCategory, Priority } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';

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
      limit = '25',
    } = req.query;

    const searchTerm = (typeof search === 'string' ? search : typeof q === 'string' ? q : '')?.trim();
    const statusFilter = typeof status === 'string' ? status.toUpperCase() : undefined;
    const priorityFilter = typeof priority === 'string' ? priority.toUpperCase() : undefined;
    const categoryFilter = typeof category === 'string' ? category.toUpperCase() : undefined;
    const assignedToFilter = typeof assignedTo === 'string' ? assignedTo.trim() : undefined;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 25));
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
 * GET /api/tickets/:id
 * Returns single ticket details with messages.
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
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

export default router;
