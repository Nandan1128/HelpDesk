import { Router, Response } from 'express';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Apply auth and admin check to all user routes
router.use(requireAuth, requireRole('ADMIN'));

/**
 * GET /api/users
 * List users with support for search, role filtering, status filtering, sorting, and pagination.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search,
      q,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '50',
    } = req.query;

    const searchTerm = (typeof search === 'string' ? search : typeof q === 'string' ? q : '')?.trim();
    const roleFilter = typeof role === 'string' ? role.toUpperCase() : undefined;
    const statusFilter = typeof status === 'string' ? status.toLowerCase() : undefined;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.UserWhereInput = {};

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (roleFilter && (roleFilter === 'ADMIN' || roleFilter === 'AGENT')) {
      where.role = roleFilter as Role;
    }

    if (statusFilter === 'active') {
      where.isActive = true;
    } else if (statusFilter === 'inactive') {
      where.isActive = false;
    }

    const validSortFields = ['createdAt', 'updatedAt', 'name', 'email', 'role'];
    const sortField = validSortFields.includes(String(sortBy)) ? String(sortBy) : 'createdAt';
    const orderDirection = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              assignedTickets: true,
            },
          },
        },
        orderBy: {
          [sortField]: orderDirection,
        },
        skip,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.json({
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to retrieve user list' });
  }
});

/**
 * GET /api/users/:id
 * Retrieve single user by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedTickets: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return res.status(500).json({ error: 'Failed to retrieve user details' });
  }
});

export default router;
