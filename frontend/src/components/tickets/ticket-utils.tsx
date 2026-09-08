import { CheckCircle2, Clock, AlertCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TicketStatus, Priority, TicketCategory } from './types';

export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function getStatusBadge(status: TicketStatus) {
  switch (status) {
    case 'OPEN':
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1.5 font-semibold"
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Open
        </Badge>
      );
    case 'RESOLVED':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 font-semibold"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Resolved
        </Badge>
      );
    case 'CLOSED':
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border gap-1.5 font-semibold"
        >
          <Clock className="w-3.5 h-3.5" />
          Closed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function getPriorityBadge(priority: Priority) {
  switch (priority) {
    case 'URGENT':
      return (
        <Badge
          variant="outline"
          className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40 gap-1 font-bold shadow-xs"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Urgent
        </Badge>
      );
    case 'HIGH':
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 gap-1 font-semibold"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          High
        </Badge>
      );
    case 'MEDIUM':
      return (
        <Badge
          variant="outline"
          className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 font-medium"
        >
          Medium
        </Badge>
      );
    case 'LOW':
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border font-normal"
        >
          Low
        </Badge>
      );
    default:
      return <Badge variant="secondary">{priority}</Badge>;
  }
}

export function getCategoryLabel(category: TicketCategory): string {
  switch (category) {
    case 'TECHNICAL_QUESTION':
      return 'Technical Question';
    case 'REFUND_REQUEST':
      return 'Refund Request';
    case 'GENERAL_QUESTION':
    default:
      return 'General Question';
  }
}
