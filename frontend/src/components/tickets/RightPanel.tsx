import { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { TicketDetail, AgentUser, TicketStatus, Priority, TicketCategory } from './types';
import { formatDate } from './ticket-utils';

export interface RightPanelProps {
  ticket: TicketDetail;
  agents: AgentUser[];
  currentUserId?: string | null;
  onUpdateTicket: (
    updates: Partial<{
      status: TicketStatus;
      priority: Priority;
      category: TicketCategory;
      assignedToId: string | null;
    }>,
    type: 'status' | 'priority' | 'category' | 'assignee'
  ) => Promise<void>;
  updatingStatus?: boolean;
  updatingPriority?: boolean;
  updatingCategory?: boolean;
  updatingAssignee?: boolean;
  onClassify?: () => Promise<void>;
  classifying?: boolean;
}

export function RightPanel({
  ticket,
  agents,
  currentUserId,
  onUpdateTicket,
  updatingStatus = false,
  updatingPriority = false,
  updatingCategory = false,
  updatingAssignee = false,
  onClassify,
  classifying = false,
}: RightPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6" data-testid="right-panel-container">
      {/* Ticket Management & Control Panel */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Ticket Details & Control
          </CardTitle>
          {onClassify && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={classifying || updatingCategory || updatingPriority}
              onClick={onClassify}
              className="h-7 px-2 text-xs font-medium gap-1 text-primary hover:text-primary hover:bg-primary/10 border-primary/30 cursor-pointer"
              title="Automatically classify ticket category and priority using Gemini"
              data-testid="auto-classify-button"
            >
              <Sparkles className={`h-3 w-3 ${classifying ? 'animate-spin' : ''}`} />
              <span>{classifying ? 'Classifying...' : 'Auto-Classify'}</span>
            </Button>
          )}
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
                  onClick={() => onUpdateTicket({ status: st }, 'status')}
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
                onUpdateTicket({ priority: e.target.value as Priority }, 'priority')
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
                onUpdateTicket(
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
                onUpdateTicket({ assignedToId: nextVal }, 'assignee');
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
            {currentUserId && ticket.assignedToId !== currentUserId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onUpdateTicket({ assignedToId: currentUserId }, 'assignee')
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
  );
}

export default RightPanel;
