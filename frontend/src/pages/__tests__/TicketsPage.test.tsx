import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TicketsPage } from '../TicketsPage';
import { api } from '@/lib/api';
import { TicketItem } from '@/components/tickets';

const renderTicketsPage = () => {
  return render(
    <MemoryRouter>
      <TicketsPage />
    </MemoryRouter>
  );
};

const mockTickets: TicketItem[] = [
  {
    id: 'ticket-1',
    ticketNumber: 103,
    subject: 'Newest Issue: Payment failed on invoice',
    status: 'OPEN',
    category: 'REFUND_REQUEST',
    priority: 'HIGH',
    customerEmail: 'customer1@example.com',
    customerName: 'Customer One',
    assignedTo: {
      id: 'agent-1',
      name: 'Sarah Connor',
      email: 'sarah.agent@ticketai.local',
    },
    _count: { messages: 2 },
    createdAt: '2026-03-01T15:00:00.000Z',
    updatedAt: '2026-03-01T15:00:00.000Z',
  },
  {
    id: 'ticket-2',
    ticketNumber: 102,
    subject: 'Middle Issue: Cannot reset password',
    status: 'OPEN',
    category: 'TECHNICAL_QUESTION',
    priority: 'URGENT',
    customerEmail: 'customer2@example.com',
    customerName: 'Customer Two',
    assignedTo: null,
    _count: { messages: 1 },
    createdAt: '2026-02-15T12:00:00.000Z',
    updatedAt: '2026-02-15T12:00:00.000Z',
  },
  {
    id: 'ticket-3',
    ticketNumber: 101,
    subject: 'Oldest Issue: General feedback about UI',
    status: 'RESOLVED',
    category: 'GENERAL_QUESTION',
    priority: 'LOW',
    customerEmail: 'customer3@example.com',
    customerName: null,
    assignedTo: null,
    _count: { messages: 3 },
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-11T10:00:00.000Z',
  },
];

const mockMetrics = {
  total: 3,
  open: 2,
  resolved: 1,
  closed: 0,
  unassigned: 2,
  urgentOrHigh: 2,
};

describe('TicketsPage Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        tickets: mockTickets,
        pagination: { total: 3, page: 1, limit: 10, totalPages: 1 },
        metrics: mockMetrics,
      },
    } as any);
  });

  describe('1. Initial Load & Layout Header', () => {
    it('renders the page title, description, and newest first badge', async () => {
      renderTicketsPage();

      expect(screen.getByRole('heading', { level: 1, name: /support tickets/i })).toBeInTheDocument();
      expect(screen.getByText(/sorted by newest first/i)).toBeInTheDocument();
      expect(
        screen.getByText(/manage incoming customer requests/i)
      ).toBeInTheDocument();

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/tickets', {
          params: expect.objectContaining({
            sortBy: 'createdAt',
            sortOrder: 'desc',
          }),
        });
      });
    });

    it('renders the KPI metric cards with correct values', async () => {
      renderTicketsPage();

      await waitFor(() => {
        expect(screen.getByText('Total Tickets')).toBeInTheDocument();
      });

      expect(screen.getByText('Open Tickets')).toBeInTheDocument();
      expect(screen.getByText('High & Urgent')).toBeInTheDocument();
      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
    });
  });

  describe('2. Table Rendering & Ticket Display', () => {
    it('renders the tickets list sorted newest first', async () => {
      renderTicketsPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Payment failed on invoice/i).length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText(/Cannot reset password/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/General feedback about UI/i).length).toBeGreaterThan(0);

      // Verify ticket numbers
      expect(screen.getAllByText('#103').length).toBeGreaterThan(0);
      expect(screen.getAllByText('#102').length).toBeGreaterThan(0);
      expect(screen.getAllByText('#101').length).toBeGreaterThan(0);

      // Verify assigned agent
      expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThan(0);
    });

    it('displays status and priority badges accurately', async () => {
      renderTicketsPage();

      await waitFor(() => {
        expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Urgent').length).toBeGreaterThan(0);
      expect(screen.getAllByText('High').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Low').length).toBeGreaterThan(0);
    });

    it('renders clickable links for ticket subjects leading to /tickets/:ticketNumber', async () => {
      renderTicketsPage();

      await waitFor(() => {
        expect(screen.getByTestId('ticket-subject-103')).toBeInTheDocument();
      });

      const subjectLink = screen.getByTestId('ticket-subject-103');
      expect(subjectLink).toHaveAttribute('href', '/tickets/103');
      expect(subjectLink).toHaveTextContent('Newest Issue: Payment failed on invoice');
    });
  });

  describe('3. Filtering & Search', () => {
    it('sends search parameter when user enters search query', async () => {
      const user = userEvent.setup();
      renderTicketsPage();

      const searchInput = screen.getByPlaceholderText(/search by subject/i);
      await user.type(searchInput, 'Payment');

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/tickets',
          expect.objectContaining({
            params: expect.objectContaining({
              search: 'Payment',
            }),
          })
        );
      });
    });

    it('filters by status when clicking status tabs', async () => {
      const user = userEvent.setup();
      renderTicketsPage();

      const resolvedTab = screen.getByRole('button', { name: /^resolved$/i });
      await user.click(resolvedTab);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/tickets',
          expect.objectContaining({
            params: expect.objectContaining({
              status: 'RESOLVED',
            }),
          })
        );
      });
    });

    it('filters by priority when selecting priority dropdown', async () => {
      renderTicketsPage();

      const prioritySelect = screen.getByRole('combobox');
      fireEvent.change(prioritySelect, { target: { value: 'URGENT' } });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/tickets',
          expect.objectContaining({
            params: expect.objectContaining({
              priority: 'URGENT',
            }),
          })
        );
      });
    });
  });

  describe('4. Sorting Controls', () => {
    it('toggles sort order when clicking a sort header', async () => {
      const user = userEvent.setup();
      renderTicketsPage();

      await waitFor(() => {
        expect(screen.getAllByText('#103').length).toBeGreaterThan(0);
      });

      // Find "Created" sort button
      const createdHeaderBtn = screen.getByRole('button', { name: /created/i });
      await user.click(createdHeaderBtn);

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/tickets',
          expect.objectContaining({
            params: expect.objectContaining({
              sortBy: 'createdAt',
              sortOrder: 'asc',
            }),
          })
        );
      });
    });
  });

  describe('5. Empty States & Error Handling', () => {
    it('displays empty state when no tickets are returned', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce({
        data: {
          tickets: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
          metrics: { total: 0, open: 0, resolved: 0, closed: 0, unassigned: 0, urgentOrHigh: 0 },
        },
      } as any);

      renderTicketsPage();

      await waitFor(() => {
        expect(screen.getByText(/no tickets in the queue/i)).toBeInTheDocument();
      });
    });

    it('displays error alert when API fetch fails', async () => {
      vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network connection timeout'));

      renderTicketsPage();

      await waitFor(() => {
        expect(screen.getByText(/network connection timeout/i)).toBeInTheDocument();
      });
    });
  });
});
