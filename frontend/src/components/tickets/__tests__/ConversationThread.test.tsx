import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationThread } from '../ConversationThread';
import { api } from '@/lib/api';
import type { TicketDetail } from '../types';

const mockTicket: TicketDetail = {
  id: 'ticket-101',
  ticketNumber: 42,
  subject: 'Cannot login with OAuth',
  status: 'OPEN',
  category: 'TECHNICAL_QUESTION',
  priority: 'HIGH',
  customerEmail: 'customer@example.com',
  customerName: 'Jane Customer',
  assignedToId: 'agent-1',
  assignedTo: {
    id: 'agent-1',
    name: 'Sarah Connor',
    email: 'sarah@ticketai.local',
  },
  aiSummary: 'Customer encountered a 400 OAuth redirect failure when logging in with Google.',
  aiSuggestedReply: 'Hello Jane, please ensure third-party cookies are enabled in your browser settings.',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:30:00.000Z',
  messages: [
    {
      id: 'msg-1',
      ticketId: 'ticket-101',
      senderType: 'CUSTOMER',
      senderEmail: 'customer@example.com',
      senderName: 'Jane Customer',
      body: 'I click sign in with Google and get a bad request error.',
      createdAt: '2026-03-01T12:00:00.000Z',
    },
    {
      id: 'msg-2',
      ticketId: 'ticket-101',
      senderType: 'AGENT',
      senderEmail: 'sarah@ticketai.local',
      senderName: 'Sarah Connor',
      body: 'Checking the OAuth configuration for your tenant.',
      createdAt: '2026-03-01T12:15:00.000Z',
    },
    {
      id: 'msg-3',
      ticketId: 'ticket-101',
      senderType: 'SYSTEM',
      senderEmail: 'system@ticketai.local',
      senderName: 'System Bot',
      body: 'Automated diagnostic test initiated.',
      createdAt: '2026-03-01T12:20:00.000Z',
    },
  ],
};

describe('ConversationThread Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. AI Features (Summary & Suggested Replies)', () => {
    it('renders the AI summary card when aiSummary is present', () => {
      render(<ConversationThread ticket={mockTicket} />);

      expect(screen.getByText('AI Conversation Summary')).toBeInTheDocument();
      expect(
        screen.getByText(/Customer encountered a 400 OAuth redirect failure/i)
      ).toBeInTheDocument();
    });

    it('does not render AI summary card when aiSummary is null', () => {
      render(
        <ConversationThread
          ticket={{ ...mockTicket, aiSummary: null }}
        />
      );

      expect(screen.queryByText('AI Conversation Summary')).not.toBeInTheDocument();
    });

    it('renders AI suggested reply and populates textarea when clicking "Use This Draft"', async () => {
      const user = userEvent.setup();
      render(<ConversationThread ticket={mockTicket} />);

      expect(screen.getByText('AI Suggested Reply')).toBeInTheDocument();
      expect(
        screen.getByText(/Hello Jane, please ensure third-party cookies are enabled/i)
      ).toBeInTheDocument();

      const useDraftBtn = screen.getByRole('button', { name: /use this draft/i });
      await user.click(useDraftBtn);

      const textarea = screen.getByPlaceholderText(/write your response to the customer/i);
      expect(textarea).toHaveValue(mockTicket.aiSuggestedReply);
    });

    it('populates textarea when clicking "Insert AI Draft" in the composer header', async () => {
      const user = userEvent.setup();
      render(<ConversationThread ticket={mockTicket} />);

      const insertBtn = screen.getByRole('button', { name: /insert ai draft/i });
      await user.click(insertBtn);

      const textarea = screen.getByPlaceholderText(/write your response to the customer/i);
      expect(textarea).toHaveValue(mockTicket.aiSuggestedReply);
    });
  });

  describe('2. Message History Thread', () => {
    it('renders all messages with correct sender badges and contents', () => {
      render(<ConversationThread ticket={mockTicket} />);

      expect(screen.getByText('Conversation Thread')).toBeInTheDocument();
      expect(screen.getByText('3 messages')).toBeInTheDocument();

      // Messages content
      expect(
        screen.getByText('I click sign in with Google and get a bad request error.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Checking the OAuth configuration for your tenant.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Automated diagnostic test initiated.')
      ).toBeInTheDocument();

      // Badges
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('renders empty state when ticket has no messages', () => {
      render(
        <ConversationThread
          ticket={{ ...mockTicket, messages: [] }}
        />
      );

      expect(
        screen.getByText('No messages recorded in this ticket yet.')
      ).toBeInTheDocument();
      expect(screen.getByText('0 messages')).toBeInTheDocument();
    });
  });

  describe('3. Reply Composer & Interactions', () => {
    it('displays sender identity and customer recipient info', () => {
      render(
        <ConversationThread
          ticket={mockTicket}
          currentUserName="Agent Fox Mulder"
        />
      );

      expect(screen.getByText('Agent Fox Mulder')).toBeInTheDocument();
      expect(screen.getAllByText('customer@example.com').length).toBeGreaterThanOrEqual(1);
    });

    it('disables send buttons when reply text is empty and enables them after typing', async () => {
      const user = userEvent.setup();
      render(<ConversationThread ticket={mockTicket} />);

      const sendBtn = screen.getByRole('button', { name: /send reply/i });
      const sendAndResolveBtn = screen.getByRole('button', { name: /send & resolve/i });

      // Buttons should be disabled when empty
      expect(sendBtn).toBeDisabled();
      expect(sendAndResolveBtn).toBeDisabled();

      // Type text into textarea
      const textarea = screen.getByPlaceholderText(/write your response to the customer/i);
      await user.type(textarea, 'Hello customer');

      expect(sendBtn).toBeEnabled();
      expect(sendAndResolveBtn).toBeEnabled();
    });

    it('sends regular reply via api.post and triggers onTicketUpdated callback', async () => {
      const user = userEvent.setup();
      const onTicketUpdated = vi.fn();
      const newMessage = {
        id: 'msg-new',
        ticketId: 'ticket-101',
        senderType: 'AGENT' as const,
        senderEmail: 'sarah@ticketai.local',
        senderName: 'Sarah Connor',
        body: 'We have updated your redirect URI.',
        createdAt: '2026-03-01T13:00:00.000Z',
      };
      const updatedTicket: TicketDetail = {
        ...mockTicket,
        messages: [...mockTicket.messages, newMessage],
      };

      vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: { message: newMessage, ticket: updatedTicket },
      } as any);

      render(
        <ConversationThread
          ticket={mockTicket}
          onTicketUpdated={onTicketUpdated}
        />
      );

      const textarea = screen.getByPlaceholderText(/write your response to the customer/i);
      await user.type(textarea, 'We have updated your redirect URI.');

      const sendBtn = screen.getByRole('button', { name: /send reply/i });
      await user.click(sendBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/tickets/ticket-101/messages', {
          body: 'We have updated your redirect URI.',
        });
      });

      expect(onTicketUpdated).toHaveBeenCalledWith(updatedTicket);
      expect(screen.getByText('Reply sent successfully!')).toBeInTheDocument();
      expect(textarea).toHaveValue('');
    });

    it('sends reply and resolves ticket when clicking "Send & Resolve"', async () => {
      const user = userEvent.setup();
      const onTicketUpdated = vi.fn();
      const resolvedTicket: TicketDetail = {
        ...mockTicket,
        status: 'RESOLVED',
      };

      vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: { ticket: resolvedTicket },
      } as any);

      render(
        <ConversationThread
          ticket={mockTicket}
          onTicketUpdated={onTicketUpdated}
        />
      );

      const textarea = screen.getByPlaceholderText(/write your response to the customer/i);
      await user.type(textarea, 'Closing this issue as solved.');

      const sendAndResolveBtn = screen.getByRole('button', { name: /send & resolve/i });
      await user.click(sendAndResolveBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/tickets/ticket-101/messages', {
          body: 'Closing this issue as solved.',
          status: 'RESOLVED',
        });
      });

      expect(onTicketUpdated).toHaveBeenCalledWith(resolvedTicket);
      expect(screen.getByText('Reply sent and ticket resolved!')).toBeInTheDocument();
    });

    it('displays error alert when sending reply fails and preserves draft', async () => {
      const user = userEvent.setup();
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        response: { data: { error: 'Network error communicating with server' } },
      });

      render(<ConversationThread ticket={mockTicket} />);

      const textarea = screen.getByPlaceholderText(/write your response to the customer/i);
      await user.type(textarea, 'My drafted answer');

      const sendBtn = screen.getByRole('button', { name: /send reply/i });
      await user.click(sendBtn);

      await waitFor(() => {
        expect(
          screen.getByText('Network error communicating with server')
        ).toBeInTheDocument();
      });

      // Draft remains in the textarea
      expect(textarea).toHaveValue('My drafted answer');
    });
  });
});
