import { Router, Response } from 'express';
import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { hashPassword } from 'better-auth/crypto';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Apply auth and admin check to all user routes
router.use(requireAuth, requireRole('ADMIN'));

const createUserSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(3, 'Name must be at least 3 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .trim()
    .min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'AGENT']).optional().default('AGENT'),
});

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .optional(),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .optional(),
  password: z
    .string()
    .trim()
    .refine((val) => val === '' || val.length >= 8, {
      message: 'Password must be at least 8 characters',
    })
    .optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST /api/users
 * Create a new user account (Admin only)
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors[0]?.message || 'Invalid input data';
    return res.status(400).json({ error: errorMsg, errors: parseResult.error.errors });
  }

  const { name, email, password, role } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user with this email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return res.status(400).json({ error: 'A user with this email already exists' });
  }

  const hashedPassword = await hashPassword(password);

  // Create user and credential account in transaction
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        role: role as Role,
        isActive: true,
        emailVerified: true,
      },
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

    await tx.account.create({
      data: {
        accountId: user.id,
        userId: user.id,
        providerId: 'credential',
        issuer: 'local:credential',
        password: hashedPassword,
      },
    });

    return user;
  });

  return res.status(201).json({
    user: newUser,
    message: 'User created successfully',
  });
});

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

/**
 * PATCH /api/users/:id
 * PUT /api/users/:id
 * Update user account details and optionally change password (Admin only)
 */
const handleUpdateUser = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors[0]?.message || 'Invalid input data';
    return res.status(400).json({ error: errorMsg, errors: parseResult.error.errors });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { name, email, password, role, isActive } = parseResult.data;

  // Check email uniqueness if email is changed
  let normalizedEmail: string | undefined;
  if (email) {
    normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== existingUser.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (emailConflict) {
        return res.status(400).json({ error: 'A user with this email already exists' });
      }
    }
  }

  // Check if a new non-empty password is provided
  const shouldUpdatePassword = typeof password === 'string' && password.trim().length >= 8;
  const hashedPassword = shouldUpdatePassword ? await hashPassword(password.trim()) : null;

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(role ? { role: role as Role } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
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

    if (shouldUpdatePassword && hashedPassword) {
      const credentialAccount = await tx.account.findFirst({
        where: {
          userId: id,
          providerId: 'credential',
        },
      });

      if (credentialAccount) {
        await tx.account.update({
          where: { id: credentialAccount.id },
          data: { password: hashedPassword },
        });
      } else {
        await tx.account.create({
          data: {
            accountId: id,
            userId: id,
            providerId: 'credential',
            issuer: 'local:credential',
            password: hashedPassword,
          },
        });
      }
    }

    return user;
  });

  return res.json({
    user: updatedUser,
    message: 'User updated successfully',
  });
};

router.patch('/:id', handleUpdateUser);
router.put('/:id', handleUpdateUser);

export default router;
