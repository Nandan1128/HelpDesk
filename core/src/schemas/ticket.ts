import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters')
    .max(255, 'Subject cannot exceed 255 characters'),
  category: z
    .enum(['GENERAL_QUESTION', 'TECHNICAL_QUESTION', 'REFUND_REQUEST'])
    .optional()
    .default('GENERAL_QUESTION'),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .optional()
    .default('MEDIUM'),
  customerEmail: z
    .string()
    .trim()
    .email('Please enter a valid email address'),
  customerName: z
    .string()
    .trim()
    .max(100, 'Customer name cannot exceed 100 characters')
    .optional()
    .nullable(),
  body: z
    .string()
    .trim()
    .min(1, 'Message body cannot be empty'),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['NEW', 'PROCESSING', 'OPEN', 'RESOLVED', 'CLOSED']),
});

export const updateTicketPrioritySchema = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

export const updateTicketCategorySchema = z.object({
  category: z.enum(['GENERAL_QUESTION', 'TECHNICAL_QUESTION', 'REFUND_REQUEST']),
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().uuid('Invalid user ID').nullable(),
});

export const addTicketMessageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Message body cannot be empty'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type UpdateTicketPriorityInput = z.infer<typeof updateTicketPrioritySchema>;
export type UpdateTicketCategoryInput = z.infer<typeof updateTicketCategorySchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;
