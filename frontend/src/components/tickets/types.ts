export type TicketStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST';
export type SenderType = 'CUSTOMER' | 'AGENT' | 'SYSTEM';

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: SenderType;
  senderEmail: string;
  senderName?: string | null;
  body: string;
  messageIdHeader?: string | null;
  inReplyToHeader?: string | null;
  createdAt: string;
}

export interface TicketDetail {
  id: string;
  ticketNumber: number;
  subject: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: Priority;
  customerEmail: string;
  customerName?: string | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  aiSummary?: string | null;
  aiSuggestedReply?: string | null;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface TicketItem {
  id: string;
  ticketNumber: number;
  subject: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: Priority;
  customerEmail: string;
  customerName?: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
  _count?: {
    messages: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type TicketSortField =
  | 'createdAt'
  | 'updatedAt'
  | 'ticketNumber'
  | 'priority'
  | 'status'
  | 'subject';

export type TicketSortOrder = 'asc' | 'desc';
