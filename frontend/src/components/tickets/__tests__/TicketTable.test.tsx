import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TicketTable } from '../TicketTable';
import type { TicketItem } from '../types';

const mockTickets: TicketItem[] = [
  {
    id: 'ticket-1',
    ticketNumber: 101,
    subject: 'Server error on dashboard',
    status: 'OPEN',
    category: 'TECHNICAL_QUESTION',
    priority: 'URGENT',
    customerEmail: 'alice@example.com',
    customerName: 'Alice Smith',
    assignedTo: {
      id: 'agent-1',
      name: 'John Agent',
      email: 'john@example.com',
    },
    _count: { messages: 3 },
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  },
  {
    id: 'ticket-2',
    ticketNumber: 102,
    subject: 'Billing inquiry regarding invoice #42',
    status: 'RESOLVED',
    category: 'REFUND_REQUEST',
    priority: 'HIGH',
    customerEmail: 'bob@example.com',
    customerName: 'Bob Jones',
    assignedTo: null,
    _count: { messages: 1 },
    createdAt: '2026-02-15T08:30:00.000Z',
    updatedAt: '2026-02-16T09:00:00.000Z',
  },
  {
    id: 'ticket-3',
    ticketNumber: 103,
    subject: 'How to change email address',
    status: 'CLOSED',
    category: 'GENERAL_QUESTION',
    priority: 'LOW',
    customerEmail: 'carol@example.com',
    customerName: null,
    assignedTo: null,
    createdAt: '2026-01-20T14:15:00.000Z',
    updatedAt: '2026-01-21T11:00:00.000Z',
  },
];

describe('TicketTable Component Tests (TanStack Table Server-Side Sorting)', () => {
  describe('1. Table Rendering & Structure', () => {
    it('renders all column headers in desktop view', () => {
      render(<TicketTable tickets={mockTickets} />);

      expect(screen.getByRole('button', { name: /ticket #/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /subject & customer/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /priority/i })).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Assigned To')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /created/i })).toBeInTheDocument();
    });

    it('renders ticket rows with correct data and badges', () => {
      render(<TicketTable tickets={mockTickets} />);

      expect(screen.getByTestId('ticket-row-ticket-1')).toBeInTheDocument();
      expect(screen.getByTestId('ticket-row-ticket-2')).toBeInTheDocument();
      expect(screen.getByTestId('ticket-row-ticket-3')).toBeInTheDocument();

      expect(screen.getAllByText('#101').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Server error on dashboard').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
      expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0);
      expect(screen.getAllByText('John Agent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Technical').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Urgent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    });

    it('renders unassigned placeholder when assignedTo is null', () => {
      render(<TicketTable tickets={mockTickets} />);
      expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
    });
  });

  describe('2. TanStack Table Server-Side Sorting Controls', () => {
    it('preserves exact server order without client-side reordering (manualSorting: true)', () => {
      render(
        <TicketTable
          tickets={mockTickets}
          sorting={[{ id: 'createdAt', desc: true }]}
        />
      );

      const rows = screen.getAllByRole('row');
      // Row 0 is header row, Row 1 is ticket-1, Row 2 is ticket-2, Row 3 is ticket-3
      expect(rows[1]).toHaveAttribute('data-testid', 'ticket-row-ticket-1');
      expect(rows[2]).toHaveAttribute('data-testid', 'ticket-row-ticket-2');
      expect(rows[3]).toHaveAttribute('data-testid', 'ticket-row-ticket-3');
    });

    it('calls onSortingChange with toggled direction when clicking active sorted column', async () => {
      const user = userEvent.setup();
      const onSortingChangeMock = vi.fn();

      render(
        <TicketTable
          tickets={mockTickets}
          sorting={[{ id: 'createdAt', desc: true }]}
          onSortingChange={onSortingChangeMock}
        />
      );

      const createdBtn = screen.getByRole('button', { name: /created/i });
      await user.click(createdBtn);

      expect(onSortingChangeMock).toHaveBeenCalledTimes(1);
      const updater = onSortingChangeMock.mock.calls[0][0];
      const nextState = typeof updater === 'function' ? updater([{ id: 'createdAt', desc: true }]) : updater;
      expect(nextState).toEqual([{ id: 'createdAt', desc: false }]);
    });

    it('calls onSortingChange when clicking a different sortable column', async () => {
      const user = userEvent.setup();
      const onSortingChangeMock = vi.fn();

      render(
        <TicketTable
          tickets={mockTickets}
          sorting={[{ id: 'createdAt', desc: true }]}
          onSortingChange={onSortingChangeMock}
        />
      );

      const ticketNumBtn = screen.getByRole('button', { name: /ticket #/i });
      await user.click(ticketNumBtn);

      expect(onSortingChangeMock).toHaveBeenCalledTimes(1);
      const updater = onSortingChangeMock.mock.calls[0][0];
      const nextState = typeof updater === 'function' ? updater([{ id: 'createdAt', desc: true }]) : updater;
      expect(nextState).toEqual([{ id: 'ticketNumber', desc: true }]);
    });

    it('calls onToggleSort fallback when onSortingChange is not provided', async () => {
      const user = userEvent.setup();
      const onToggleSortMock = vi.fn();

      render(
        <TicketTable
          tickets={mockTickets}
          sortBy="createdAt"
          sortOrder="desc"
          onToggleSort={onToggleSortMock}
        />
      );

      const priorityBtn = screen.getByRole('button', { name: /priority/i });
      await user.click(priorityBtn);

      expect(onToggleSortMock).toHaveBeenCalledWith('priority');
    });

    it('does not have sort buttons on non-sortable columns', () => {
      render(<TicketTable tickets={mockTickets} />);

      expect(screen.queryByRole('button', { name: /^category$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^assigned to$/i })).not.toBeInTheDocument();
    });
  });

  describe('3. Loading & Empty States', () => {
    it('renders skeleton loading placeholders when loading=true', () => {
      render(<TicketTable tickets={[]} loading={true} />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('renders empty queue message when tickets list is empty and not filtered', () => {
      render(<TicketTable tickets={[]} loading={false} isFiltered={false} />);
      expect(screen.getByText('No tickets in the queue')).toBeInTheDocument();
    });

    it('renders no matching tickets message and clear filters button when isFiltered=true', async () => {
      const user = userEvent.setup();
      const onClearFiltersMock = vi.fn();

      render(
        <TicketTable
          tickets={[]}
          loading={false}
          isFiltered={true}
          onClearFilters={onClearFiltersMock}
        />
      );

      expect(screen.getByText('No matching tickets found')).toBeInTheDocument();
      const clearBtn = screen.getByRole('button', { name: /clear filters/i });
      await user.click(clearBtn);
      expect(onClearFiltersMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Ticket Row Interaction', () => {
    it('calls onSelectTicket when a ticket row is clicked', async () => {
      const user = userEvent.setup();
      const onSelectTicketMock = vi.fn();

      render(
        <TicketTable
          tickets={mockTickets}
          onSelectTicket={onSelectTicketMock}
        />
      );

      const firstRow = screen.getByTestId('ticket-row-ticket-1');
      await user.click(firstRow);

      expect(onSelectTicketMock).toHaveBeenCalledWith(mockTickets[0]);
    });
  });
});
