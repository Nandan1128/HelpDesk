import { useState, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Sparkles,
  Bot,
  MessageSquare,
  User,
  UserCheck,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TicketDetail, TicketMessage, TicketStatus } from './types';
import { formatDate } from './ticket-utils';

export interface ConversationThreadProps {
  ticket: TicketDetail;
  ticketId?: string;
  onTicketUpdated?: (updatedTicket: TicketDetail) => void;
  currentUserName?: string;
}

export function ConversationThread({
  ticket,
  ticketId,
  onTicketUpdated,
  currentUserName = 'Support Agent',
}: ConversationThreadProps) {
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const targetId = ticketId || ticket?.id;

  const handleUseAiDraft = () => {
    if (!ticket?.aiSuggestedReply) return;
    setReplyBody(ticket.aiSuggestedReply);
    replyTextareaRef.current?.focus();
  };

  const handleSendReply = async (resolveTicket = false) => {
    if (!targetId) return;
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
      }>(`/tickets/${targetId}/messages`, payload);

      onTicketUpdated?.(response.data.ticket);
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

  return (
    <div className="space-y-6" data-testid="conversation-thread-container">
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
              Sender: <strong>{currentUserName}</strong>
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
  );
}

export default ConversationThread;
