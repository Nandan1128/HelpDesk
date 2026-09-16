import type { TicketStatus, Priority, TicketCategory, SenderType } from '../types/ticket.js';

export const TICKET_STATUSES: readonly TicketStatus[] = [
  'NEW',
  'PROCESSING',
  'OPEN',
  'RESOLVED',
  'CLOSED',
] as const;

export const TICKET_PRIORITIES: readonly Priority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
] as const;

export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  'GENERAL_QUESTION',
  'TECHNICAL_QUESTION',
  'REFUND_REQUEST',
] as const;

export const SENDER_TYPES: readonly SenderType[] = [
  'CUSTOMER',
  'AGENT',
  'SYSTEM',
] as const;

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'New',
  PROCESSING: 'Processing',
  OPEN: 'Open',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const TICKET_PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL_QUESTION: 'General Question',
  TECHNICAL_QUESTION: 'Technical Question',
  REFUND_REQUEST: 'Refund Request',
};

export const SENDER_TYPE_LABELS: Record<SenderType, string> = {
  CUSTOMER: 'Customer',
  AGENT: 'Agent',
  SYSTEM: 'System AI',
};
