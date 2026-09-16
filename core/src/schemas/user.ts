import { z } from 'zod';

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  password: z
    .string()
    .trim()
    .min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'AGENT']).optional().default('AGENT'),
});

export const updateUserSchema = z.object({
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

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
