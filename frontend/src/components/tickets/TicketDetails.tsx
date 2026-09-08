import { User, Calendar, Tag, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TicketDetail } from './types';
import {
  formatDate,
  getStatusBadge,
  getPriorityBadge,
  getCategoryLabel,
} from './ticket-utils';

export interface TicketDetailsProps {
  ticket: TicketDetail;
  updateFeedback?: string | null;
}

export function TicketDetails({ ticket, updateFeedback }: TicketDetailsProps) {
  return (
    <Card className="border-border bg-card shadow-xs" data-testid="ticket-details-card">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <h1
              className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
              data-testid="ticket-detail-subject"
            >
              {ticket.subject}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <strong>Customer:</strong>{' '}
                <span className="text-foreground">
                  {ticket.customerName
                    ? `${ticket.customerName} (${ticket.customerEmail})`
                    : ticket.customerEmail}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <strong>Opened:</strong> {formatDate(ticket.createdAt)}
              </span>
            </div>
          </div>

          {/* Badges strip */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {getStatusBadge(ticket.status)}
            {getPriorityBadge(ticket.priority)}
            <Badge
              variant="outline"
              className="bg-muted/70 text-muted-foreground border-border text-xs gap-1 font-medium"
            >
              <Tag className="w-3 h-3" />
              {getCategoryLabel(ticket.category)}
            </Badge>
          </div>
        </div>

        {updateFeedback && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-2">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription className="text-xs font-medium">
              {updateFeedback}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default TicketDetails;
