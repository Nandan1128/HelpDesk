import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  TicketDetails,
  ConversationThread,
  RightPanel,
} from '@/components/tickets';
import type {
  TicketStatus,
  Priority,
  TicketCategory,
  SenderType,
  TicketMessage,
  TicketDetail,
  AgentUser,
} from '@/components/tickets';

// Re-export types for backward compatibility with existing tests and imports
export type {
  TicketStatus,
  Priority,
  TicketCategory,
  SenderType,
  TicketMessage,
  TicketDetail,
  AgentUser,
};

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sessionData } = useSession();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Ticket update states
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  const fetchTicket = useCallback(
    async (isManual = false) => {
      if (!id) return;
      if (isManual) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setNotFound(false);

      try {
        const response = await api.get<{ ticket: TicketDetail }>(`/tickets/${id}`);
        setTicket(response.data.ticket);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          const msg =
            err?.response?.data?.error ||
            err?.message ||
            'Failed to load ticket details.';
          setError(msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  const fetchAgents = useCallback(async () => {
    try {
      const res = await api.get<{ agents: AgentUser[] }>('/tickets/agents');
      if (res.data?.agents) {
        setAgents(res.data.agents);
      }
    } catch {
      // Non-critical: fail silently if agents list endpoint fails or is unauthorized
    }
  }, []);

  useEffect(() => {
    fetchTicket();
    fetchAgents();
  }, [fetchTicket, fetchAgents]);

  const handleUpdateTicket = async (
    updates: Partial<{
      status: TicketStatus;
      priority: Priority;
      category: TicketCategory;
      assignedToId: string | null;
    }>,
    type: 'status' | 'priority' | 'category' | 'assignee'
  ) => {
    if (!id || !ticket) return;

    if (type === 'status') setUpdatingStatus(true);
    if (type === 'priority') setUpdatingPriority(true);
    if (type === 'category') setUpdatingCategory(true);
    if (type === 'assignee') setUpdatingAssignee(true);
    setUpdateFeedback(null);

    try {
      const response = await api.patch<{ ticket: TicketDetail }>(
        `/tickets/${id}`,
        updates
      );
      setTicket(response.data.ticket);
      setUpdateFeedback('Ticket updated successfully.');
      setTimeout(() => setUpdateFeedback(null), 3000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to update ticket details.';
      setError(msg);
    } finally {
      setUpdatingStatus(false);
      setUpdatingPriority(false);
      setUpdatingCategory(false);
      setUpdatingAssignee(false);
    }
  };

  const handlePolishReply = async (draftText: string): Promise<string> => {
    const targetId = id || ticket?.id;
    if (!targetId) {
      throw new Error('Ticket ID is missing.');
    }

    const response = await api.post<{
      polishedReply: string;
      text?: string;
    }>(`/tickets/${targetId}/polish`, {
      draft: draftText,
    });

    return response.data.polishedReply || response.data.text || draftText;
  };

  const handleSummarizeTicket = async (): Promise<string> => {
    const targetId = id || ticket?.id;
    if (!targetId) {
      throw new Error('Ticket ID is missing.');
    }

    const response = await api.post<{
      summary: string;
      ticket?: TicketDetail;
    }>(`/tickets/${targetId}/summarize`);

    if (response.data.ticket) {
      setTicket(response.data.ticket);
    } else if (response.data.summary && ticket) {
      setTicket({ ...ticket, aiSummary: response.data.summary });
    }

    return response.data.summary;
  };

  // Skeleton Loader State
  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto" data-testid="ticket-detail-loading">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-24 bg-muted animate-pulse rounded-lg" />
          <div className="h-6 w-16 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-muted animate-pulse rounded w-3/4" />
          <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-muted/60 animate-pulse rounded-xl" />
            <div className="h-64 bg-muted/60 animate-pulse rounded-xl" />
          </div>
          <div className="space-y-4">
            <div className="h-64 bg-muted/60 animate-pulse rounded-xl" />
            <div className="h-40 bg-muted/60 animate-pulse rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Not Found State (404)
  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5" data-testid="ticket-not-found">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Ticket Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested ticket does not exist or may have been deleted.
          </p>
        </div>
        <Link
          to="/tickets"
          className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tickets
        </Link>
      </div>
    );
  }

  // Error State
  if (error && !ticket) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4" data-testid="ticket-error">
        <Alert className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
        </Alert>
        <div className="flex items-center space-x-3">
          <Button onClick={() => fetchTicket(false)} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
          <Link
            to="/tickets"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'cursor-pointer')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tickets
          </Link>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" data-testid="ticket-detail-container">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/tickets"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shadow-xs cursor-pointer')}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Tickets
          </Link>
          <Badge
            variant="outline"
            className="font-mono text-xs px-2.5 py-1 bg-muted/60 border-border text-foreground font-bold"
          >
            #{ticket.ticketNumber}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTicket(true)}
            disabled={refreshing}
            className="shadow-xs"
            title="Refresh ticket data"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Ticket Details Summary Card */}
      <TicketDetails ticket={ticket} updateFeedback={updateFeedback} />

      {/* Main 2-Column Grid: Conversation Thread on Left, Right Panel Sidebar on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: AI Highlights, Messages Thread, Reply Composer */}
        <div className="lg:col-span-2 space-y-6">
          <ConversationThread
            ticket={ticket}
            ticketId={id || ticket.id}
            onTicketUpdated={setTicket}
            currentUserName={sessionData?.user?.name || 'Support Agent'}
            onPolish={handlePolishReply}
            onSummarize={handleSummarizeTicket}
          />
        </div>

        {/* Right Column: Ticket Management Sidebar */}
        <RightPanel
          ticket={ticket}
          agents={agents}
          currentUserId={sessionData?.user?.id}
          onUpdateTicket={handleUpdateTicket}
          updatingStatus={updatingStatus}
          updatingPriority={updatingPriority}
          updatingCategory={updatingCategory}
          updatingAssignee={updatingAssignee}
        />
      </div>
    </div>
  );
}

export default TicketDetailPage;
