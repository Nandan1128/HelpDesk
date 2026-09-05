import { useState, useEffect, useCallback, useMemo } from 'react';
import { SortingState } from '@tanstack/react-table';
import { api } from '@/lib/api';
import {
  Ticket,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Inbox,
} from 'lucide-react';
import {
  TicketTable,
  TicketItem,
  TicketSortField,
  TicketSortOrder,
  TicketStatus,
  Priority,
} from '@/components/TicketTable';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TicketMetrics {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  unassigned: number;
  urgentOrHigh: number;
}

interface TicketListResponse {
  tickets: TicketItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  metrics: TicketMetrics;
}

export function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [metrics, setMetrics] = useState<TicketMetrics>({
    total: 0,
    open: 0,
    resolved: 0,
    closed: 0,
    unassigned: 0,
    urgentOrHigh: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | Priority>('ALL');

  // Sorting state: Defaults to newest first (createdAt: desc) using TanStack Table SortingState
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  const sortBy = useMemo<TicketSortField>(() => {
    return (sorting[0]?.id as TicketSortField) || 'createdAt';
  }, [sorting]);

  const sortOrder = useMemo<TicketSortOrder>(() => {
    return sorting[0]?.desc ? 'desc' : 'asc';
  }, [sorting]);

  const fetchTickets = useCallback(
    async (isManualRefresh = false, targetPage = pagination.page) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params: Record<string, string> = {
          sortBy,
          sortOrder,
          page: String(targetPage),
          limit: String(pagination.limit),
        };

        if (debouncedSearchQuery.trim()) {
          params.search = debouncedSearchQuery.trim();
        }
        if (statusFilter !== 'ALL') {
          params.status = statusFilter;
        }
        if (priorityFilter !== 'ALL') {
          params.priority = priorityFilter;
        }

        const response = await api.get<TicketListResponse>('/tickets', {
          params,
        });

        setTickets(response.data.tickets || []);
        if (response.data.metrics) {
          setMetrics(response.data.metrics);
        }
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } catch (err: any) {
        const message =
          err?.response?.data?.error ||
          err?.message ||
          'Failed to load tickets. Please check your connection.';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedSearchQuery, statusFilter, priorityFilter, sortBy, sortOrder, pagination.limit]
  );

  useEffect(() => {
    fetchTickets(false, 1);
  }, [debouncedSearchQuery, statusFilter, priorityFilter, sortBy, sortOrder]);

  const handleToggleSort = (field: TicketSortField) => {
    setSorting((prev) => {
      const current = prev[0];
      if (current && current.id === field) {
        return [{ id: field, desc: !current.desc }];
      }
      return [{ id: field, desc: true }];
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setSorting([{ id: 'createdAt', desc: true }]);
  };

  const isFiltered = useMemo(() => {
    return (
      debouncedSearchQuery.trim() !== '' ||
      statusFilter !== 'ALL' ||
      priorityFilter !== 'ALL'
    );
  }, [debouncedSearchQuery, statusFilter, priorityFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Support Tickets
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage incoming customer requests, support triage, and issue resolutions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs py-1 px-2.5 bg-muted/60 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Sorted by Newest First
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTickets(true)}
            disabled={refreshing || loading}
            className="shadow-xs"
            title="Refresh tickets list"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Tickets
              </p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{metrics.total}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Open Tickets
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {metrics.open}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                High & Urgent
              </p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {metrics.urgentOrHigh}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Resolved
              </p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {metrics.resolved}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="border-border bg-card shadow-xs p-3.5 sm:p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by subject, customer, or #123..."
              className="pl-9 pr-8 text-xs sm:text-sm h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border">
              {(['ALL', 'OPEN', 'RESOLVED', 'CLOSED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {status === 'ALL'
                    ? 'All'
                    : status === 'OPEN'
                    ? 'Open'
                    : status === 'RESOLVED'
                    ? 'Resolved'
                    : 'Closed'}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="h-9 px-2.5 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Clear All Filters */}
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Ticket Table */}
      <TicketTable
        tickets={tickets}
        loading={loading}
        isFiltered={isFiltered}
        sorting={sorting}
        onSortingChange={setSorting}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onToggleSort={handleToggleSort}
        onClearFilters={handleClearFilters}
      />

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <div className="text-xs text-muted-foreground">
            Showing Page <strong>{pagination.page}</strong> of{' '}
            <strong>{pagination.totalPages}</strong> ({pagination.total} total tickets)
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTickets(false, pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchTickets(false, pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="h-8 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TicketsPage;
