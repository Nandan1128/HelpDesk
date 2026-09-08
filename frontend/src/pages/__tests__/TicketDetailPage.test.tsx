import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TicketDetailPage, TicketDetail } from '../TicketDetailPage';
import { api } from '@/lib/api';

const mockTicket: TicketDetail = {
  id: 'test-ticket-123',
  ticketNumber: 42,
  subject: 'Broken payment gateway during checkout',
  status: 'OPEN',
  category: 'REFUND_REQUEST',
  priority: 'URGENT',
  customerEmail: 'customer@example.com',
  customerName: 'Jane Doe',
  assignedToId: 'agent-1',
  assignedTo: {
    id: 'agent-1',
    name: 'Sarah Connor',
    email: 'sarah.agent@ticketai.local',
  },
  aiSummary: 'Customer attempted checkout with credit card ending in 4242 but received error 500.',
  aiSuggestedReply: 'Hi Jane, we apologize for the trouble. Your payment was automatically reversed and no charge was processed.',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:30:00.000Z',
  messages: [
    {
      id: 'msg-1',
      ticketId: 'test-ticket-123',
      senderType: 'CUSTOMER',
      senderEmail: 'customer@example.com',
      senderName: 'Jane Doe',
      body: 'I tried to pay but got a server error! Did my card get charged?',
      createdAt: '2026-03-01T12:00:00.000Z',
    },
    {
      id: 'msg-2',
      ticketId: 'test-ticket-123',
      senderType: 'AGENT',
      senderEmail: 'sarah.agent@ticketai.local',
      senderName: 'Sarah Connor',
      body: 'Looking into this now for you Jane.',
      createdAt: '2026-03-01T12:15:00.000Z',
    },
  ],
};

const mockAgents = [
  { id: 'agent-1', name: 'Sarah Connor', email: 'sarah.agent@ticketai.local', role: 'AGENT' },
  { id: 'agent-2', name: 'John Matrix', email: 'john.agent@ticketai.local', role: 'AGENT' },
];

const renderTicketDetailPage = (ticketId: string | number = '42') => {
  return render(
    <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('TicketDetailPage Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url.includes('/tickets/agents')) {
        return Promise.resolve({ data: { agents: mockAgents } } as any);
      }
      if (url.includes('/tickets/42') || url.includes('/tickets/test-ticket-123')) {
        return Promise.resolve({ data: { ticket: mockTicket } } as any);
      }
      return Promise.reject({ response: { status: 404 } });
    });
  });

  describe('1. Loading & Initial Ticket Rendering', () => {
    it('renders ticket details, header metadata, and navigation buttons', async () => {
      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByTestId('ticket-detail-subject')).toHaveTextContent(
          'Broken payment gateway during checkout'
        );
      });

      expect(screen.getAllByText('#42').length).toBeGreaterThan(0);
      expect(screen.getByText(/back to tickets/i)).toBeInTheDocument();
      expect(screen.getByText('Jane Doe (customer@example.com)')).toBeInTheDocument();
      expect(screen.getAllByText('Urgent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Refund Request').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    });

    it('renders customer information and metadata sidebar', async () => {
      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByText('Customer Information')).toBeInTheDocument();
      });

      expect(screen.getAllByText('customer@example.com').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
      expect(screen.getByText('Ticket Metadata')).toBeInTheDocument();
    });
  });

  describe('2. AI Features (Summary & Suggested Replies)', () => {
    it('displays the AI Conversation Summary banner', async () => {
      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByText('AI Conversation Summary')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Customer attempted checkout with credit card ending in 4242/i)
      ).toBeInTheDocument();
    });

    it('does not display the AI Suggested Reply card and renders Polish button', async () => {
      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByText('Broken payment gateway during checkout')).toBeInTheDocument();
      });

      expect(screen.queryByText('AI Suggested Reply')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /polish/i })).toBeInTheDocument();
    });

    it('polishes agent reply when clicking Polish button', async () => {
      const user = userEvent.setup();
      vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          polishedReply: 'Hi Jane, we have reviewed your payment transaction and issued a full refund.',
        },
      } as any);

      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/write your response/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/write your response/i);
      await user.type(textarea, 'we looked into the charge and refunded it');

      const polishBtn = screen.getByRole('button', { name: /polish/i });
      expect(polishBtn).toBeEnabled();

      await user.click(polishBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/tickets/42/polish', {
          draft: 'we looked into the charge and refunded it',
        });
      });

      await waitFor(() => {
        expect(textarea).toHaveValue(
          'Hi Jane, we have reviewed your payment transaction and issued a full refund.'
        );
      });
    });

    it('displays error alert when polish API fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(api, 'post').mockRejectedValueOnce({
        response: {
          data: {
            error: 'Failed to connect to Gemini API. Check your API key.',
          },
        },
      });

      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/write your response/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/write your response/i);
      await user.type(textarea, 'draft message');

      const polishBtn = screen.getByRole('button', { name: /polish/i });
      await user.click(polishBtn);

      await waitFor(() => {
        expect(
          screen.getByText('Failed to connect to Gemini API. Check your API key.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('3. Conversation Thread', () => {
    it('renders chronological message thread with sender tags and message contents', async () => {
      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByText(/Conversation Thread/i)).toBeInTheDocument();
      });

      expect(screen.getByText('2 messages')).toBeInTheDocument();
      expect(screen.getByText('I tried to pay but got a server error! Did my card get charged?')).toBeInTheDocument();
      expect(screen.getByText('Looking into this now for you Jane.')).toBeInTheDocument();
      expect(screen.getByText('Customer')).toBeInTheDocument();
      expect(screen.getAllByText('Support Agent').length).toBeGreaterThan(0);
    });
  });

  describe('4. Ticket Controls & Updates', () => {
    it('updates ticket status when clicking status button', async () => {
      const user = userEvent.setup();
      const updatedMock = { ...mockTicket, status: 'RESOLVED' as const };
      vi.spyOn(api, 'patch').mockResolvedValueOnce({
        data: { ticket: updatedMock },
      } as any);

      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^resolved$/i })).toBeInTheDocument();
      });

      const resolvedBtn = screen.getByRole('button', { name: /^resolved$/i });
      await user.click(resolvedBtn);

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith('/tickets/42', {
          status: 'RESOLVED',
        });
      });
    });

    it('updates ticket priority via dropdown', async () => {
      const updatedMock = { ...mockTicket, priority: 'MEDIUM' as const };
      vi.spyOn(api, 'patch').mockResolvedValueOnce({
        data: { ticket: updatedMock },
      } as any);

      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue('Urgent')).toBeInTheDocument();
      });

      const prioritySelect = screen.getByDisplayValue('Urgent');
      fireEvent.change(prioritySelect, { target: { value: 'MEDIUM' } });

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith('/tickets/42', {
          priority: 'MEDIUM',
        });
      });
    });
  });

  describe('5. Reply Composer & Sending Messages', () => {
    it('submits a new agent reply and refreshes message thread', async () => {
      const user = userEvent.setup();
      const newMessage = {
        id: 'msg-3',
        ticketId: 'test-ticket-123',
        senderType: 'AGENT' as const,
        senderEmail: 'sarah.agent@ticketai.local',
        senderName: 'Sarah Connor',
        body: 'Issue resolved, have a great day!',
        createdAt: '2026-03-01T13:00:00.000Z',
      };
      const updatedTicketWithNewMessage = {
        ...mockTicket,
        messages: [...mockTicket.messages, newMessage],
      };

      vi.spyOn(api, 'post').mockResolvedValueOnce({
        data: {
          message: newMessage,
          ticket: updatedTicketWithNewMessage,
        },
      } as any);

      renderTicketDetailPage();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/write your response/i)).toBeInTheDocument();
      });

      const textarea = screen.getByPlaceholderText(/write your response/i);
      await user.type(textarea, 'Issue resolved, have a great day!');

      const sendBtn = screen.getByRole('button', { name: /send reply/i });
      await user.click(sendBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/tickets/42/messages', {
          body: 'Issue resolved, have a great day!',
        });
      });

      expect(screen.getByText('Reply sent successfully!')).toBeInTheDocument();
    });
  });

  describe('6. Error and Not Found States', () => {
    it('renders 404 Not Found state when ticket is missing', async () => {
      renderTicketDetailPage('non-existent-ticket-id');

      await waitFor(() => {
        expect(screen.getByTestId('ticket-not-found')).toBeInTheDocument();
      });

      expect(screen.getByText('Ticket Not Found')).toBeInTheDocument();
    });

    it('renders error state with retry button when server returns 500', async () => {
      vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Internal server failure'));

      renderTicketDetailPage('test-ticket-123');

      await waitFor(() => {
        expect(screen.getByTestId('ticket-error')).toBeInTheDocument();
      });

      expect(screen.getByText(/internal server failure/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
