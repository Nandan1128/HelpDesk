import {
  Ticket,
  ArrowUpDown,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  UserCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type TicketStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST';

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

export interface TicketTableProps {
  tickets: TicketItem[];
  loading?: boolean;
  isFiltered?: boolean;
  sortBy?: TicketSortField;
  sortOrder?: TicketSortOrder;
  onToggleSort?: (field: TicketSortField) => void;
  onClearFilters?: () => void;
  onSelectTicket?: (ticket: TicketItem) => void;
}

export function TicketTable({
  tickets,
  loading = false,
  isFiltered = false,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onToggleSort,
  onClearFilters,
  onSelectTicket,
}: TicketTableProps) {
  const formatDate = (dateString: string) => {
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
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1 font-semibold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Open
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold"
          >
            <CheckCircle2 className="w-3 h-3" />
            Resolved
          </Badge>
        );
      case 'CLOSED':
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border gap-1 font-semibold"
          >
            <Clock className="w-3 h-3" />
            Closed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'URGENT':
        return (
          <Badge
            variant="outline"
            className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40 gap-1 font-bold shadow-xs"
          >
            <AlertCircle className="w-3 h-3" />
            Urgent
          </Badge>
        );
      case 'HIGH':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 gap-1 font-semibold"
          >
            <AlertTriangle className="w-3 h-3" />
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
  };

  const getCategoryLabel = (category: TicketCategory) => {
    switch (category) {
      case 'TECHNICAL_QUESTION':
        return 'Technical';
      case 'REFUND_REQUEST':
        return 'Refund';
      case 'GENERAL_QUESTION':
      default:
        return 'General';
    }
  };

  const renderSortIcon = (field: TicketSortField) => {
    const isActive = sortBy === field;
    return (
      <ArrowUpDown
        className={`w-3.5 h-3.5 ml-1 inline-block transition-transform ${
          isActive ? 'text-primary' : 'opacity-40'
        } ${isActive && sortOrder === 'desc' ? 'rotate-180' : ''}`}
      />
    );
  };

  // Skeleton loading state
  if (loading) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="p-6 space-y-4">
            <div className="h-4 bg-muted animate-pulse rounded w-1/4" />
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 bg-muted/60 animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (tickets.length === 0) {
    return (
      <Card className="border-border bg-card shadow-sm text-center py-12">
        <CardContent className="flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Ticket className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              {isFiltered ? 'No matching tickets found' : 'No tickets in the queue'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {isFiltered
                ? 'Try adjusting your search query, status, or priority filters to find what you need.'
                : 'Customer inquiries sent via support email will appear here automatically.'}
            </p>
          </div>
          {isFiltered && onClearFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden">
      {/* Desktop Data Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[90px]">
                <button
                  type="button"
                  onClick={() => onToggleSort?.('ticketNumber')}
                  className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Ticket # {renderSortIcon('ticketNumber')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  onClick={() => onToggleSort?.('subject')}
                  className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Subject & Customer {renderSortIcon('subject')}
                </button>
              </TableHead>
              <TableHead className="w-[120px]">
                <button
                  type="button"
                  onClick={() => onToggleSort?.('status')}
                  className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Status {renderSortIcon('status')}
                </button>
              </TableHead>
              <TableHead className="w-[110px]">
                <button
                  type="button"
                  onClick={() => onToggleSort?.('priority')}
                  className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Priority {renderSortIcon('priority')}
                </button>
              </TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[140px]">Assigned To</TableHead>
              <TableHead className="w-[160px] text-right">
                <button
                  type="button"
                  onClick={() => onToggleSort?.('createdAt')}
                  className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer justify-end w-full"
                >
                  Created {renderSortIcon('createdAt')}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                onClick={() => onSelectTicket?.(ticket)}
                className={`hover:bg-muted/50 transition-colors ${
                  onSelectTicket ? 'cursor-pointer' : ''
                }`}
                data-testid={`ticket-row-${ticket.id}`}
              >
                {/* Ticket Number */}
                <TableCell className="font-mono font-bold text-xs text-muted-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded border border-border">
                    #{ticket.ticketNumber}
                  </span>
                </TableCell>

                {/* Subject & Customer Details */}
                <TableCell>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1">
                        {ticket.subject}
                      </span>
                      {ticket._count && ticket._count.messages > 1 && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-medium text-muted-foreground"
                          title={`${ticket._count.messages} messages in thread`}
                        >
                          <MessageSquare className="w-2.5 h-2.5" />
                          {ticket._count.messages}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      {ticket.customerName && (
                        <span className="font-medium text-foreground/80">
                          {ticket.customerName}
                        </span>
                      )}
                      <span className="truncate max-w-[220px]" title={ticket.customerEmail}>
                        {ticket.customerEmail}
                      </span>
                    </div>
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell>{getStatusBadge(ticket.status)}</TableCell>

                {/* Priority */}
                <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>

                {/* Category */}
                <TableCell>
                  <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
                    {getCategoryLabel(ticket.category)}
                  </span>
                </TableCell>

                {/* Assigned Agent */}
                <TableCell>
                  {ticket.assignedTo ? (
                    <div className="flex items-center space-x-1.5 text-xs text-foreground font-medium">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="truncate max-w-[110px]" title={ticket.assignedTo.name}>
                        {ticket.assignedTo.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic flex items-center gap-1">
                      <User className="w-3.5 h-3.5 opacity-40" />
                      Unassigned
                    </span>
                  )}
                </TableCell>

                {/* Created Date */}
                <TableCell className="text-right text-xs text-muted-foreground font-medium">
                  {formatDate(ticket.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card List View (Phones & Small Tablets) */}
      <div className="md:hidden divide-y divide-border">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            onClick={() => onSelectTicket?.(ticket)}
            className="p-4 space-y-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                #{ticket.ticketNumber}
              </span>
              <div className="flex items-center space-x-2">
                {getPriorityBadge(ticket.priority)}
                {getStatusBadge(ticket.status)}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground line-clamp-2">
                {ticket.subject}
              </h4>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>{ticket.customerName || ticket.customerEmail}</span>
                <span>{formatDate(ticket.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs border-t border-border/50">
              <span className="text-muted-foreground">
                Category: <strong className="text-foreground">{getCategoryLabel(ticket.category)}</strong>
              </span>
              <span>
                {ticket.assignedTo ? (
                  <span className="text-emerald-600 font-medium">
                    {ticket.assignedTo.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 italic">Unassigned</span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default TicketTable;
