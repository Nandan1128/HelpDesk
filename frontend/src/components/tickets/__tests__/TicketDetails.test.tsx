import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TicketDetails } from '../TicketDetails';
import type { TicketDetail } from '../types';

const baseTicket: TicketDetail = {
  id: 'ticket-101',
  ticketNumber: 42,
  subject: 'Cannot access billing invoice',
  status: 'OPEN',
  category: 'GENERAL_QUESTION',
  priority: 'MEDIUM',
  customerEmail: 'alice@example.com',
  customerName: 'Alice Smith',
  assignedToId: 'agent-1',
  assignedTo: {
    id: 'agent-1',
    name: 'Sarah Connor',
    email: 'sarah@ticketai.local',
  },
  aiSummary: null,
  aiSuggestedReply: null,
  messages: [],
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T11:00:00.000Z',
};

describe('TicketDetails Component Tests', () => {
  describe('1. Basic Rendering & Information', () => {
    it('renders the subject heading with data-testid="ticket-detail-subject"', () => {
      render(<TicketDetails ticket={baseTicket} />);

      const heading = screen.getByTestId('ticket-detail-subject');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Cannot access billing invoice');
    });

    it('renders customer name and email when customerName is provided', () => {
      render(<TicketDetails ticket={baseTicket} />);

      expect(screen.getByText('Alice Smith (alice@example.com)')).toBeInTheDocument();
    });

    it('renders only customer email when customerName is null or omitted', () => {
      const ticketWithoutName: TicketDetail = {
        ...baseTicket,
        customerName: null,
        customerEmail: 'no-name@example.com',
      };
      render(<TicketDetails ticket={ticketWithoutName} />);

      expect(screen.getByText('no-name@example.com')).toBeInTheDocument();
      expect(screen.queryByText(/null/i)).not.toBeInTheDocument();
    });

    it('renders the formatted creation date', () => {
      render(<TicketDetails ticket={baseTicket} />);

      expect(screen.getByText(/opened:/i)).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  describe('2. Status Badges', () => {
    it('renders the Open badge for OPEN status', () => {
      render(<TicketDetails ticket={{ ...baseTicket, status: 'OPEN' }} />);

      const badge = screen.getByText('Open');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[data-slot="badge"]')).toHaveClass('bg-blue-500/10');
    });

    it('renders the Resolved badge for RESOLVED status', () => {
      render(<TicketDetails ticket={{ ...baseTicket, status: 'RESOLVED' }} />);

      const badge = screen.getByText('Resolved');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[data-slot="badge"]')).toHaveClass('bg-emerald-500/10');
    });

    it('renders the Closed badge for CLOSED status', () => {
      render(<TicketDetails ticket={{ ...baseTicket, status: 'CLOSED' }} />);

      const badge = screen.getByText('Closed');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[data-slot="badge"]')).toHaveClass('bg-muted');
    });
  });

  describe('3. Priority Badges', () => {
    it('renders the Urgent badge for URGENT priority', () => {
      render(<TicketDetails ticket={{ ...baseTicket, priority: 'URGENT' }} />);

      const badge = screen.getByText('Urgent');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[data-slot="badge"]')).toHaveClass('bg-red-500/15');
    });

    it('renders the High badge for HIGH priority', () => {
      render(<TicketDetails ticket={{ ...baseTicket, priority: 'HIGH' }} />);

      const badge = screen.getByText('High');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[data-slot="badge"]')).toHaveClass('bg-amber-500/15');
    });

    it('renders the Medium badge for MEDIUM priority', () => {
      render(<TicketDetails ticket={{ ...baseTicket, priority: 'MEDIUM' }} />);

      const badge = screen.getByText('Medium');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[data-slot="badge"]')).toHaveClass('bg-sky-500/10');
    });

    it('renders the Low badge for LOW priority', () => {
      render(<TicketDetails ticket={{ ...baseTicket, priority: 'LOW' }} />);

      const badge = screen.getByText('Low');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('[data-slot="badge"]')).toHaveClass('bg-muted');
    });
  });

  describe('4. Category Badges', () => {
    it('renders "General Question" for GENERAL_QUESTION category', () => {
      render(<TicketDetails ticket={{ ...baseTicket, category: 'GENERAL_QUESTION' }} />);

      expect(screen.getByText('General Question')).toBeInTheDocument();
    });

    it('renders "Technical Question" for TECHNICAL_QUESTION category', () => {
      render(<TicketDetails ticket={{ ...baseTicket, category: 'TECHNICAL_QUESTION' }} />);

      expect(screen.getByText('Technical Question')).toBeInTheDocument();
    });

    it('renders "Refund Request" for REFUND_REQUEST category', () => {
      render(<TicketDetails ticket={{ ...baseTicket, category: 'REFUND_REQUEST' }} />);

      expect(screen.getByText('Refund Request')).toBeInTheDocument();
    });
  });

  describe('5. Update Feedback Alert', () => {
    it('renders the feedback alert when updateFeedback message is provided', () => {
      render(
        <TicketDetails
          ticket={baseTicket}
          updateFeedback="Ticket priority updated successfully."
        />
      );

      expect(screen.getByText('Ticket priority updated successfully.')).toBeInTheDocument();
    });

    it('does not render feedback alert when updateFeedback is null or omitted', () => {
      render(<TicketDetails ticket={baseTicket} updateFeedback={null} />);

      expect(screen.queryByText(/ticket priority updated successfully/i)).not.toBeInTheDocument();
    });
  });
});
