import { useMemo, useCallback } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  OnChangeFn,
} from '@tanstack/react-table';
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
import type {
  TicketStatus,
  Priority,
  TicketCategory,
  TicketItem,
  TicketSortField,
  TicketSortOrder,
} from './types';

export interface TicketTableProps {
  tickets: TicketItem[];
  loading?: boolean;
  isFiltered?: boolean;
  sortBy?: TicketSortField;
  sortOrder?: TicketSortOrder;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  onToggleSort?: (field: TicketSortField) => void;
  onClearFilters?: () => void;
  onSelectTicket?: (ticket: TicketItem) => void;
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
  }
}

export function TicketSubjectLink({
  ticketNumber,
  ticketId,
  children,
  className,
  onClick,
  ...props
}: {
  ticketNumber?: number;
  ticketId?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  [key: string]: any;
}) {
  const targetId = ticketNumber !== undefined ? ticketNumber : ticketId;
  const inRouter = useInRouterContext();
  if (inRouter) {
    return (
      <Link to={`/tickets/${targetId}`} className={className} onClick={onClick} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <a href={`/tickets/${targetId}`} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  );
}

export function TicketTable({
  tickets,
  loading = false,
  isFiltered = false,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  sorting,
  onSortingChange,
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
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'NEW':
        return (
          <Badge
            variant="outline"
            className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 gap-1 font-semibold"
          >
            New
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Processing
          </Badge>
        );
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

  const renderSortIcon = (isSorted: false | 'asc' | 'desc') => {
    const isActive = Boolean(isSorted);
    return (
      <ArrowUpDown
        className={`w-3.5 h-3.5 ml-1 inline-block transition-transform ${
          isActive ? 'text-primary' : 'opacity-40'
        } ${isSorted === 'desc' ? 'rotate-180' : ''}`}
      />
    );
  };

  // Derive active sorting state from either sorting prop or sortBy/sortOrder
  const currentSorting: SortingState = useMemo(() => {
    if (sorting !== undefined) {
      return sorting;
    }
    return [{ id: sortBy, desc: sortOrder === 'desc' }];
  }, [sorting, sortBy, sortOrder]);

  const handleSortingChange: OnChangeFn<SortingState> = useCallback(
    (updaterOrValue) => {
      if (onSortingChange) {
        onSortingChange(updaterOrValue);
      } else if (onToggleSort) {
        const nextSorting =
          typeof updaterOrValue === 'function'
            ? updaterOrValue(currentSorting)
            : updaterOrValue;
        if (nextSorting.length > 0) {
          onToggleSort(nextSorting[0].id as TicketSortField);
        }
      }
    },
    [currentSorting, onSortingChange, onToggleSort]
  );

  const columns = useMemo<ColumnDef<TicketItem>[]>(
    () => [
      {
        id: 'ticketNumber',
        accessorKey: 'ticketNumber',
        enableSorting: true,
        sortDescFirst: true,
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Ticket # {renderSortIcon(column.getIsSorted())}
          </button>
        ),
        cell: ({ row }) => (
          <span className="bg-muted px-2 py-0.5 rounded border border-border">
            #{row.original.ticketNumber}
          </span>
        ),
        meta: {
          headerClassName: 'w-[90px]',
          cellClassName: 'font-mono font-bold text-xs text-muted-foreground',
        },
      },
      {
        id: 'subject',
        accessorKey: 'subject',
        enableSorting: true,
        sortDescFirst: true,
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Subject & Customer {renderSortIcon(column.getIsSorted())}
          </button>
        ),
        cell: ({ row }) => {
          const ticket = row.original;
          return (
            <div className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <TicketSubjectLink
                  ticketNumber={ticket.ticketNumber}
                  ticketId={ticket.id}
                  className="font-semibold text-sm text-foreground hover:text-primary transition-colors line-clamp-1 no-underline cursor-pointer"
                  data-testid={`ticket-subject-${ticket.ticketNumber || ticket.id}`}
                  onClick={() => onSelectTicket?.(ticket)}
                >
                  {ticket.subject}
                </TicketSubjectLink>
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
          );
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        enableSorting: true,
        sortDescFirst: true,
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Status {renderSortIcon(column.getIsSorted())}
          </button>
        ),
        cell: ({ row }) => getStatusBadge(row.original.status),
        meta: {
          headerClassName: 'w-[120px]',
        },
      },
      {
        id: 'priority',
        accessorKey: 'priority',
        enableSorting: true,
        sortDescFirst: true,
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Priority {renderSortIcon(column.getIsSorted())}
          </button>
        ),
        cell: ({ row }) => getPriorityBadge(row.original.priority),
        meta: {
          headerClassName: 'w-[110px]',
        },
      },
      {
        id: 'category',
        accessorKey: 'category',
        enableSorting: false,
        header: () => <span className="text-xs font-semibold text-muted-foreground">Category</span>,
        cell: ({ row }) => (
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border">
            {getCategoryLabel(row.original.category)}
          </span>
        ),
        meta: {
          headerClassName: 'w-[120px]',
        },
      },
      {
        id: 'assignedTo',
        enableSorting: false,
        header: () => <span className="text-xs font-semibold text-muted-foreground">Assigned To</span>,
        cell: ({ row }) => {
          const ticket = row.original;
          return ticket.assignedTo ? (
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
          );
        },
        meta: {
          headerClassName: 'w-[140px]',
        },
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        enableSorting: true,
        sortDescFirst: true,
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer justify-end w-full"
          >
            Created {renderSortIcon(column.getIsSorted())}
          </button>
        ),
        cell: ({ row }) => formatDate(row.original.createdAt),
        meta: {
          headerClassName: 'w-[160px] text-right',
          cellClassName: 'text-right text-xs text-muted-foreground font-medium',
        },
      },
    ],
    []
  );

  // Filter out any tickets being resolved by AI (NEW or PROCESSING) from table display
  const visibleTickets = useMemo(() => {
    return tickets.filter((t) => t.status !== 'NEW' && t.status !== 'PROCESSING');
  }, [tickets]);

  // TanStack Table initialization with manual server-side sorting enabled
  const table = useReactTable({
    data: visibleTickets,
    columns,
    state: {
      sorting: currentSorting,
    },
    onSortingChange: handleSortingChange,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

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
  if (visibleTickets.length === 0) {
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
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.headerClassName}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const ticket = row.original;
              return (
                <TableRow
                  key={row.id}
                  onClick={() => onSelectTicket?.(ticket)}
                  className={`hover:bg-muted/50 transition-colors ${
                    onSelectTicket ? 'cursor-pointer' : ''
                  }`}
                  data-testid={`ticket-row-${ticket.id}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.cellClassName}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card List View (Phones & Small Tablets) */}
      <div className="md:hidden divide-y divide-border">
        {table.getRowModel().rows.map((row) => {
          const ticket = row.original;
          return (
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
                <TicketSubjectLink
                  ticketNumber={ticket.ticketNumber}
                  ticketId={ticket.id}
                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 no-underline cursor-pointer inline-block"
                  data-testid={`ticket-subject-mobile-${ticket.ticketNumber || ticket.id}`}
                  onClick={() => onSelectTicket?.(ticket)}
                >
                  {ticket.subject}
                </TicketSubjectLink>
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
          );
        })}
      </div>
    </Card>
  );
}

export default TicketTable;
