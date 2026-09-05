import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  User,
  UserCheck,
  Send,
  Sparkles,
  Bot,
  Copy,
  Check,
  MessageSquare,
  Calendar,
  Tag,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

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

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: sessionData } = useSession();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Reply Composer state
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  // Ticket update states
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  // Copy feedback state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

  const handleSendReply = async (resolveTicket = false) => {
    if (!id || !ticket) return;
    const trimmed = replyBody.trim();
    if (!trimmed) {
      setReplyError('Please enter a reply message before sending.');
      return;
    }

    setSendingReply(true);
    setReplyError(null);
    setReplySuccess(null);

    try {
      const payload: { body: string; status?: TicketStatus } = {
        body: trimmed,
      };
      if (resolveTicket) {
        payload.status = 'RESOLVED';
      }

      const response = await api.post<{
        message: TicketMessage;
        ticket: TicketDetail;
      }>(`/tickets/${id}/messages`, payload);

      setTicket(response.data.ticket);
      setReplyBody('');
      setReplySuccess(
        resolveTicket
          ? 'Reply sent and ticket resolved!'
          : 'Reply sent successfully!'
      );
      setTimeout(() => setReplySuccess(null), 4000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to send reply. Please try again.';
      setReplyError(msg);
    } finally {
      setSendingReply(false);
    }
  };

  const handleUseAiDraft = () => {
    if (!ticket?.aiSuggestedReply) return;
    setReplyBody(ticket.aiSuggestedReply);
    replyTextareaRef.current?.focus();
  };

  const formatDate = (dateString?: string) => {
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
  };

  const getStatusBadge = (status: TicketStatus) => {
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
  };

  const getPriorityBadge = (priority: Priority) => {
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
  };

  const getCategoryLabel = (category: TicketCategory) => {
    switch (category) {
      case 'TECHNICAL_QUESTION':
        return 'Technical Question';
      case 'REFUND_REQUEST':
        return 'Refund Request';
      case 'GENERAL_QUESTION':
      default:
        return 'General Question';
    }
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

      {/* Ticket Header & Status Summary */}
      <Card className="border-border bg-card shadow-xs">
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
                    {ticket.customerName ? `${ticket.customerName} (${ticket.customerEmail})` : ticket.customerEmail}
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

      {/* Main 2-Column Grid: Thread & Composer on Left, Sidebar on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: AI Highlights, Messages Thread, Reply Composer */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Conversation Summary Card (if present) */}
          {ticket.aiSummary && (
            <Card className="border-primary/30 bg-primary/5 shadow-xs overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <div className="flex items-center space-x-2 text-primary font-semibold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Conversation Summary</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {ticket.aiSummary}
              </CardContent>
            </Card>
          )}

          {/* AI Suggested Response Card (if present) */}
          {ticket.aiSuggestedReply && (
            <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-xs overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                    <Bot className="w-4 h-4" />
                    <span>AI Suggested Reply</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUseAiDraft}
                    className="h-7 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Use This Draft
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                <div className="text-sm text-foreground/90 whitespace-pre-wrap bg-background/80 p-3.5 rounded-lg border border-indigo-500/20 font-sans leading-relaxed">
                  {ticket.aiSuggestedReply}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation History / Thread */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">
                    Conversation Thread
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {ticket.messages.length}{' '}
                  {ticket.messages.length === 1 ? 'message' : 'messages'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {ticket.messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No messages recorded in this ticket yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {ticket.messages.map((msg, index) => {
                    const isCustomer = msg.senderType === 'CUSTOMER';
                    const isAgent = msg.senderType === 'AGENT';

                    return (
                      <div
                        key={msg.id || index}
                        className={`p-4 rounded-xl border transition-colors ${
                          isCustomer
                            ? 'bg-muted/30 border-border'
                            : isAgent
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-muted/20 border-border/80'
                        }`}
                        data-testid={`ticket-message-${msg.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/40">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                isCustomer
                                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                                  : isAgent
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isCustomer ? (
                                <User className="w-3.5 h-3.5" />
                              ) : isAgent ? (
                                <UserCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Bot className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {msg.senderName || msg.senderEmail}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    isCustomer
                                      ? 'text-sky-600 border-sky-500/30'
                                      : isAgent
                                      ? 'text-primary border-primary/30'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {isCustomer
                                    ? 'Customer'
                                    : isAgent
                                    ? 'Support Agent'
                                    : 'System'}
                                </Badge>
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {msg.senderEmail}
                              </span>
                            </div>
                          </div>

                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(msg.createdAt)}
                          </span>
                        </div>

                        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pt-1 font-sans">
                          {msg.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reply Composer Box */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  Reply to Customer
                </CardTitle>
                {ticket.aiSuggestedReply && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleUseAiDraft}
                    className="text-xs text-primary hover:text-primary/90 h-7"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Insert AI Draft
                  </Button>
                )}
              </div>
              <CardDescription className="text-xs">
                Your response will be recorded in the thread and dispatched to{' '}
                <strong className="text-foreground">{ticket.customerEmail}</strong>.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-3.5">
              {replyError && (
                <Alert className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 py-2">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription className="text-xs font-medium">
                    {replyError}
                  </AlertDescription>
                </Alert>
              )}

              {replySuccess && (
                <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <AlertDescription className="text-xs font-medium">
                    {replySuccess}
                  </AlertDescription>
                </Alert>
              )}

              <textarea
                ref={replyTextareaRef}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write your response to the customer here..."
                rows={5}
                disabled={sendingReply}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-y"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-xs text-muted-foreground">
                  Sender: <strong>{sessionData?.user?.name || 'Support Agent'}</strong>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendReply(true)}
                    disabled={sendingReply || !replyBody.trim()}
                    className="text-xs h-9"
                    title="Send reply and mark ticket as RESOLVED"
                  >
                    {sendingReply ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                    )}
                    <span>Send & Resolve</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleSendReply(false)}
                    disabled={sendingReply || !replyBody.trim()}
                    className="text-xs h-9 shadow-xs"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        <span>Send Reply</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket Management Sidebar */}
        <div className="space-y-6">
          {/* Ticket Management & Control Panel */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Ticket Details & Control
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['OPEN', 'RESOLVED', 'CLOSED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => handleUpdateTicket({ status: st }, 'status')}
                      className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer text-center ${
                        ticket.status === st
                          ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                      }`}
                    >
                      {st === 'OPEN'
                        ? 'Open'
                        : st === 'RESOLVED'
                        ? 'Resolved'
                        : 'Closed'}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Priority Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Priority
                </label>
                <select
                  value={ticket.priority}
                  disabled={updatingPriority}
                  onChange={(e) =>
                    handleUpdateTicket({ priority: e.target.value as Priority }, 'priority')
                  }
                  className="w-full h-9 px-3 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Category
                </label>
                <select
                  value={ticket.category}
                  disabled={updatingCategory}
                  onChange={(e) =>
                    handleUpdateTicket(
                      { category: e.target.value as TicketCategory },
                      'category'
                    )
                  }
                  className="w-full h-9 px-3 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="GENERAL_QUESTION">General Question</option>
                  <option value="TECHNICAL_QUESTION">Technical Question</option>
                  <option value="REFUND_REQUEST">Refund Request</option>
                </select>
              </div>

              <Separator />

              {/* Assigned Agent Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Assigned Agent
                </label>
                <select
                  value={ticket.assignedToId || ''}
                  disabled={updatingAssignee}
                  onChange={(e) => {
                    const nextVal = e.target.value ? e.target.value : null;
                    handleUpdateTicket({ assignedToId: nextVal }, 'assignee');
                  }}
                  className="w-full h-9 px-3 text-xs bg-muted/40 border border-border rounded-lg text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.email})
                    </option>
                  ))}
                </select>

                {/* Quick "Assign to Me" Button if logged-in user is not assigned */}
                {sessionData?.user?.id &&
                  ticket.assignedToId !== sessionData.user.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleUpdateTicket(
                          { assignedToId: sessionData.user.id },
                          'assignee'
                        )
                      }
                      className="text-xs text-primary hover:text-primary/90 p-0 h-6"
                    >
                      Assign to me
                    </Button>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Metadata Card */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-semibold text-foreground text-sm mt-0.5">
                  {ticket.customerName || 'Not provided'}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground">Email:</span>
                <div className="flex items-center justify-between mt-0.5">
                  <a
                    href={`mailto:${ticket.customerEmail}`}
                    className="text-primary hover:underline font-medium truncate max-w-[200px]"
                    title={ticket.customerEmail}
                  >
                    {ticket.customerEmail}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopy(ticket.customerEmail, 'customerEmail')}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy customer email"
                  >
                    {copiedField === 'customerEmail' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ticket System Info Card */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Ticket Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-2.5 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Ticket ID:</span>
                <div className="flex items-center space-x-1.5 font-mono font-bold text-foreground">
                  <span>#{ticket.ticketNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(String(ticket.ticketNumber), 'ticketId')}
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy Ticket ID"
                  >
                    {copiedField === 'ticketId' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Created At:</span>
                <span className="text-foreground">{formatDate(ticket.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last Updated:</span>
                <span className="text-foreground">{formatDate(ticket.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TicketDetailPage;
