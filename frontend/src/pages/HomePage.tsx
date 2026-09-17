import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Ticket,
  Clock,
  Sparkles,
  Bot,
  Timer,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Layers,
  Inbox,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { useSession, AuthUser } from '@/lib/auth-client';
import { TicketsPerDayChart, DailyTicketCount } from '@/components/tickets/TicketsPerDayChart';

export type { DailyTicketCount };

export interface DashboardMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  newTickets: number;
  processingTickets: number;
  aiResolvedTickets: number;
  aiResolvedPercentage: number;
  aiResolvedRateOfResolved: number;
  averageResolutionTimeMs: number;
  averageResolutionTimeFormatted: string;
  aiAverageResolutionTimeMs: number;
  aiAverageResolutionTimeFormatted: string;
  humanAverageResolutionTimeMs: number;
  humanAverageResolutionTimeFormatted: string;
}

export interface CategoryBreakdownItem {
  category: 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST';
  count: number;
  percentage: number;
}

export interface RecentTicketItem {
  id: string;
  ticketNumber: number;
  subject: string;
  customerName: string | null;
  customerEmail: string;
  status: 'NEW' | 'PROCESSING' | 'OPEN' | 'RESOLVED' | 'CLOSED';
  category: 'GENERAL_QUESTION' | 'TECHNICAL_QUESTION' | 'REFUND_REQUEST';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  autoResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  categoryBreakdown: CategoryBreakdownItem[];
  recentTickets: RecentTicketItem[];
  ticketsPerDay?: DailyTicketCount[];
  dailyTickets?: DailyTicketCount[];
}

export function HomePage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user as AuthUser | undefined;

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboard = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await api.get<DashboardData>('/tickets/dashboard');
      setDashboard(res.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Failed to load dashboard metrics. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isAdmin = user?.role === 'ADMIN';

  const formatCategoryLabel = (category: string) => {
    switch (category) {
      case 'GENERAL_QUESTION':
        return 'General Question';
      case 'TECHNICAL_QUESTION':
        return 'Technical Question';
      case 'REFUND_REQUEST':
        return 'Refund Request';
      default:
        return category;
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'LOW':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'RESOLVED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'CLOSED':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
      case 'NEW':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
      case 'PROCESSING':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 animate-pulse';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMinutes = Math.round((Date.now() - date.getTime()) / (1000 * 60));
      if (diffMinutes < 1) return 'just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-8" data-testid="dashboard-container">
      {/* Hero Welcome & Action Bar */}
      <Card className="border-border bg-card shadow-sm overflow-hidden relative">
        <div className="absolute right-[-20px] top-[-20px] w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <CardContent className="p-6 sm:p-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold text-xs py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Support Operations Overview
                </Badge>
                <Badge variant="outline" className="font-semibold text-xs py-0.5">
                  {isAdmin ? 'Administrator' : 'Support Agent'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Support Dashboard
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Welcome back, <span className="text-foreground font-medium">{user?.name || 'Agent'}</span>! Real-time telemetry on customer inquiries, auto-resolution rates, and triage performance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchDashboard(true)}
                disabled={refreshing || loading}
                className="shadow-xs"
                title="Refresh metrics telemetry"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 text-muted-foreground ${refreshing ? 'animate-spin text-primary' : ''}`}
                />
                <span>Refresh</span>
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/tickets')}
                className="shadow-xs gap-1.5"
              >
                <Inbox className="w-4 h-4" />
                <span>View All Tickets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDashboard(false)}
              className="h-7 text-xs border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 5 Core Metrics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total Tickets */}
        <Card
          data-testid="card-total-tickets"
          className="border-border bg-card shadow-xs hover:border-border/80 transition-all cursor-pointer"
          onClick={() => navigate('/tickets')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tickets
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">
                  {dashboard?.metrics.totalTickets ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span>{(dashboard?.metrics.resolvedTickets ?? 0) + (dashboard?.metrics.closedTickets ?? 0)} resolved</span>
                  <span>•</span>
                  <span>{dashboard?.metrics.openTickets ?? 0} open</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Metric 2: Open Tickets */}
        <Card
          data-testid="card-open-tickets"
          className="border-border bg-card shadow-xs hover:border-amber-500/40 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => navigate('/tickets?status=OPEN')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Open Tickets
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">
                  {dashboard?.metrics.openTickets ?? 0}
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center">
                  <span>Requires agent action</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Metric 3: Number of Tickets Resolved by AI */}
        <Card
          data-testid="card-ai-resolved"
          className="border-border bg-card shadow-xs hover:border-indigo-500/40 hover:shadow-sm transition-all cursor-pointer"
          onClick={() => navigate('/tickets?status=RESOLVED')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resolved by AI
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">
                  {dashboard?.metrics.aiResolvedTickets ?? 0}
                </div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium flex items-center">
                  <span>Knowledge Base deflection</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Metric 4: % of Tickets Resolved by AI */}
        <Card
          data-testid="card-ai-percentage"
          className="border-border bg-card shadow-xs hover:border-emerald-500/40 hover:shadow-sm transition-all"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              % Resolved by AI
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-foreground flex items-baseline gap-1">
                  <span>{dashboard?.metrics.aiResolvedPercentage ?? 0}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, dashboard?.metrics.aiResolvedPercentage ?? 0)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {dashboard?.metrics.aiResolvedRateOfResolved ?? 0}% of resolved tickets
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Metric 5: Average Resolution Time */}
        <Card
          data-testid="card-avg-resolution-time"
          className="border-border bg-card shadow-xs hover:border-primary/40 hover:shadow-sm transition-all"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Avg Resolution Time
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-foreground">
                  {dashboard?.metrics.averageResolutionTimeFormatted ?? '0m'}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 truncate" title={`AI: ${dashboard?.metrics.aiAverageResolutionTimeFormatted || '0m'} vs Human: ${dashboard?.metrics.humanAverageResolutionTimeFormatted || '0m'}`}>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    AI: {dashboard?.metrics.aiAverageResolutionTimeFormatted || '0m'}
                  </span>
                  {' • '}
                  <span>Agent: {dashboard?.metrics.humanAverageResolutionTimeFormatted || '0m'}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart: Total Tickets Per Day (Past 30 Days) */}
      <TicketsPerDayChart
        data={dashboard?.ticketsPerDay || dashboard?.dailyTickets}
        loading={loading}
      />

      {/* Category Breakdown & Recent Tickets Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown Card */}
        <Card className="border-border bg-card shadow-xs lg:col-span-1 flex flex-col justify-between" data-testid="card-category-breakdown">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Tickets by Category
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution across standard support triage classifications
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {loading ? (
              <div className="space-y-3">
                <div className="h-10 bg-muted animate-pulse rounded-lg" />
                <div className="h-10 bg-muted animate-pulse rounded-lg" />
                <div className="h-10 bg-muted animate-pulse rounded-lg" />
              </div>
            ) : (
              dashboard?.categoryBreakdown.map((item) => (
                <div
                  key={item.category}
                  className="p-3 bg-muted/40 rounded-xl border border-border space-y-2 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {formatCategoryLabel(item.category)}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        item.category === 'GENERAL_QUESTION'
                          ? 'bg-blue-500'
                          : item.category === 'TECHNICAL_QUESTION'
                          ? 'bg-purple-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.max(item.percentage, 2)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Tickets Feed */}
        <Card className="border-border bg-card shadow-xs lg:col-span-2" data-testid="card-recent-tickets">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" /> Recent Support Tickets
              </CardTitle>
              <CardDescription className="text-xs">
                Latest customer inquiries entering the helpdesk queue
              </CardDescription>
            </div>
            <Link
              to="/tickets"
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>

          <CardContent className="pt-1">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : dashboard?.recentTickets.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No tickets in system yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {dashboard?.recentTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.ticketNumber || ticket.id}`)}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/30 px-2 rounded-lg transition-colors cursor-pointer"
                    data-testid={`recent-ticket-${ticket.ticketNumber}`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          #{ticket.ticketNumber}
                        </span>
                        <span className="text-sm font-semibold text-foreground truncate hover:text-primary">
                          {ticket.subject}
                        </span>
                        {ticket.autoResolved && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5 font-medium gap-1"
                          >
                            <Sparkles className="w-2.5 h-2.5" /> AI Resolved
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{ticket.customerName || ticket.customerEmail}</span>
                        <span>•</span>
                        <span>{formatRelativeTime(ticket.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className={`text-[10px] py-0.5 px-2 uppercase font-semibold ${getPriorityBadgeClass(ticket.priority)}`}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] py-0.5 px-2 uppercase font-semibold ${getStatusBadgeClass(ticket.status)}`}>
                        {ticket.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default HomePage;
