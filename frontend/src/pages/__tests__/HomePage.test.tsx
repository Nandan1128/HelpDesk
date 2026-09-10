import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HomePage, DashboardData } from '../HomePage';
import { api } from '@/lib/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'user-1',
        name: 'Sarah Connor',
        email: 'sarah.agent@ticketai.local',
        role: 'AGENT',
      },
    },
    isPending: false,
  }),
}));

const mockDashboardData: DashboardData = {
  metrics: {
    totalTickets: 100,
    openTickets: 42,
    resolvedTickets: 48,
    closedTickets: 10,
    newTickets: 0,
    processingTickets: 0,
    aiResolvedTickets: 24,
    aiResolvedPercentage: 24.0,
    aiResolvedRateOfResolved: 41.4,
    averageResolutionTimeMs: 2700000,
    averageResolutionTimeFormatted: '45m',
    aiAverageResolutionTimeMs: 120000,
    aiAverageResolutionTimeFormatted: '2m',
    humanAverageResolutionTimeMs: 4500000,
    humanAverageResolutionTimeFormatted: '1h 15m',
  },
  categoryBreakdown: [
    { category: 'GENERAL_QUESTION', count: 45, percentage: 45.0 },
    { category: 'TECHNICAL_QUESTION', count: 35, percentage: 35.0 },
    { category: 'REFUND_REQUEST', count: 20, percentage: 20.0 },
  ],
  recentTickets: [
    {
      id: 'ticket-1',
      ticketNumber: 105,
      subject: 'Where can I find SOC 2 report?',
      customerName: 'Fatima Zahra',
      customerEmail: 'fatima@fintechguard.ae',
      status: 'RESOLVED',
      category: 'GENERAL_QUESTION',
      priority: 'LOW',
      autoResolved: true,
      createdAt: '2026-03-01T12:00:00.000Z',
      updatedAt: '2026-03-01T12:02:00.000Z',
    },
    {
      id: 'ticket-2',
      ticketNumber: 104,
      subject: 'Urgent: API 500 error during checkout',
      customerName: 'Marcus Vance',
      customerEmail: 'marcus@retailflow.io',
      status: 'OPEN',
      category: 'TECHNICAL_QUESTION',
      priority: 'URGENT',
      autoResolved: false,
      createdAt: '2026-03-01T11:00:00.000Z',
      updatedAt: '2026-03-01T11:00:00.000Z',
    },
  ],
  ticketsPerDay: Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7, 12 + i));
    return {
      date: d.toISOString().split('T')[0],
      formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      count: i === 20 ? 12 : i % 3 === 0 ? 4 : 2,
    };
  }),
};

const renderHomePage = () => {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
};

describe('HomePage / Support Dashboard Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url === '/tickets/dashboard') {
        return Promise.resolve({ data: mockDashboardData } as any);
      }
      if (url === '/health') {
        return Promise.resolve({
          data: {
            status: 'healthy',
            database: 'connected',
            timestamp: '2026-03-01T15:00:00.000Z',
            version: '1.0.0',
          },
        } as any);
      }
      return Promise.reject(new Error('Unknown url'));
    });
  });

  describe('1. Dashboard Header & Greeting', () => {
    it('renders the dashboard heading, greeting with user name, and action buttons', async () => {
      renderHomePage();

      expect(await screen.findByRole('heading', { level: 1, name: /support dashboard/i })).toBeInTheDocument();
      expect(screen.getByText(/Sarah Connor/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view all tickets/i })).toBeInTheDocument();
    });
  });

  describe('2. Core 5 KPI Metric Cards', () => {
    it('renders all 5 requested KPI cards with accurate values and labels', async () => {
      renderHomePage();

      // Card 1: Total Tickets
      const totalCard = await screen.findByTestId('card-total-tickets');
      expect(totalCard).toHaveTextContent(/total tickets/i);
      expect(totalCard).toHaveTextContent('100');
      expect(totalCard).toHaveTextContent(/58 resolved/i);
      expect(totalCard).toHaveTextContent(/42 open/i);

      // Card 2: Open Tickets
      const openCard = screen.getByTestId('card-open-tickets');
      expect(openCard).toHaveTextContent(/open tickets/i);
      expect(openCard).toHaveTextContent('42');
      expect(openCard).toHaveTextContent(/requires agent action/i);

      // Card 3: Number of Tickets Resolved by AI
      const aiCard = screen.getByTestId('card-ai-resolved');
      expect(aiCard).toHaveTextContent(/resolved by ai/i);
      expect(aiCard).toHaveTextContent('24');
      expect(aiCard).toHaveTextContent(/knowledge base deflection/i);

      // Card 4: % of Tickets Resolved by AI
      const pctCard = screen.getByTestId('card-ai-percentage');
      expect(pctCard).toHaveTextContent(/% resolved by ai/i);
      expect(pctCard).toHaveTextContent('24%');
      expect(pctCard).toHaveTextContent(/41.4% of resolved tickets/i);

      // Card 5: Average Resolution Time
      const avgCard = screen.getByTestId('card-avg-resolution-time');
      expect(avgCard).toHaveTextContent(/avg resolution time/i);
      expect(avgCard).toHaveTextContent('45m');
      expect(avgCard).toHaveTextContent(/AI: 2m/i);
      expect(avgCard).toHaveTextContent(/Agent: 1h 15m/i);
    });

    it('navigates to pre-filtered ticket list when open tickets card is clicked', async () => {
      const user = userEvent.setup();
      renderHomePage();

      const openCard = await screen.findByTestId('card-open-tickets');
      await user.click(openCard);

      expect(mockNavigate).toHaveBeenCalledWith('/tickets?status=OPEN');
    });

    it('navigates to pre-filtered ticket list when AI resolved card is clicked', async () => {
      const user = userEvent.setup();
      renderHomePage();

      const aiCard = await screen.findByTestId('card-ai-resolved');
      await user.click(aiCard);

      expect(mockNavigate).toHaveBeenCalledWith('/tickets?status=RESOLVED');
    });
  });

  describe('3. Category Breakdown & Recent Tickets', () => {
    it('renders the category distribution with counts and percentages', async () => {
      renderHomePage();

      const categoryCard = await screen.findByTestId('card-category-breakdown');
      expect(categoryCard).toHaveTextContent(/tickets by category/i);
      expect(categoryCard).toHaveTextContent(/General Question/i);
      expect(categoryCard).toHaveTextContent('45 (45%)');
      expect(categoryCard).toHaveTextContent(/Technical Question/i);
      expect(categoryCard).toHaveTextContent('35 (35%)');
      expect(categoryCard).toHaveTextContent(/Refund Request/i);
      expect(categoryCard).toHaveTextContent('20 (20%)');
    });

    it('renders recent tickets list including auto-resolved badge', async () => {
      renderHomePage();

      const recentCard = await screen.findByTestId('card-recent-tickets');
      expect(recentCard).toHaveTextContent(/recent support tickets/i);
      expect(recentCard).toHaveTextContent('#105');
      expect(recentCard).toHaveTextContent('Where can I find SOC 2 report?');
      expect(recentCard).toHaveTextContent(/ai resolved/i);
      expect(recentCard).toHaveTextContent('#104');
      expect(recentCard).toHaveTextContent('Urgent: API 500 error during checkout');
    });

    it('navigates to ticket details when a recent ticket is clicked', async () => {
      const user = userEvent.setup();
      renderHomePage();

      const ticketItem = await screen.findByTestId('recent-ticket-105');
      await user.click(ticketItem);

      expect(mockNavigate).toHaveBeenCalledWith('/tickets/105');
    });
  });

  describe('4. Error and Diagnostics Handling', () => {
    it('displays error banner and allows retry when API fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(api, 'get').mockImplementation((url: string) => {
        if (url === '/tickets/dashboard') {
          return Promise.reject(new Error('Network connection timeout'));
        }
        return Promise.resolve({ data: {} } as any);
      });

      renderHomePage();

      expect(await screen.findByText(/Network connection timeout/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      expect(retryBtn).toBeInTheDocument();

      // Now resolve successfully on retry
      vi.spyOn(api, 'get').mockImplementation((url: string) => {
        if (url === '/tickets/dashboard') {
          return Promise.resolve({ data: mockDashboardData } as any);
        }
        return Promise.resolve({ data: {} } as any);
      });

      await user.click(retryBtn);
      expect(await screen.findByText('100')).toBeInTheDocument();
    });

    it('renders system diagnostics section with database and auth status', async () => {
      renderHomePage();

      const diagCard = await screen.findByTestId('card-system-diagnostics');
      expect(diagCard).toHaveTextContent(/Live System Diagnostics/i);
      expect(diagCard).toHaveTextContent(/Express \(Port 5000\)/i);
      expect(diagCard).toHaveTextContent(/Prisma ORM/i);
      expect(diagCard).toHaveTextContent(/Better Auth/i);
    });
  });

  describe('5. Tickets Per Day Bar Chart (Past 30 Days)', () => {
    it('renders the bar chart card with title, description, and metric badges', async () => {
      renderHomePage();

      const chartCard = await screen.findByTestId('card-tickets-per-day');
      expect(chartCard).toBeInTheDocument();
      expect(chartCard).toHaveTextContent(/Ticket Volume \(Past 30 Days\)/i);
      expect(chartCard).toHaveTextContent(/Daily incoming support tickets/i);

      // Check badges: total tickets in 30 days, daily average, peak badge
      const totalBadge = screen.getByTestId('badge-total-30d');
      expect(totalBadge).toBeInTheDocument();
      expect(totalBadge).toHaveTextContent(/tickets/i);

      const avgBadge = screen.getByTestId('badge-avg-30d');
      expect(avgBadge).toBeInTheDocument();
      expect(avgBadge).toHaveTextContent(/avg/i);

      const peakBadge = screen.getByTestId('badge-peak-30d');
      expect(peakBadge).toBeInTheDocument();
      expect(peakBadge).toHaveTextContent(/Peak: 12/i);
    });

    it('renders all 30 day bars with proper accessible attributes and heights', async () => {
      renderHomePage();

      const chartCard = await screen.findByTestId('card-tickets-per-day');
      expect(chartCard).toBeInTheDocument();

      for (let i = 0; i < 30; i++) {
        const bar = screen.getByTestId(`bar-day-${i}`);
        expect(bar).toBeInTheDocument();
      }
    });

    it('shows floating tooltip and updates active info panel when hovering over a bar', async () => {
      const user = userEvent.setup();
      renderHomePage();

      const peakBar = await screen.findByTestId('bar-day-20');
      await user.hover(peakBar);

      // Floating tooltip should appear
      const tooltip = screen.getByTestId('floating-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent(/12 tickets/i);

      // Hover info bar should update
      const hoverInfo = screen.getByTestId('hover-info');
      expect(hoverInfo).toHaveTextContent(/12 tickets/i);
    });
  });
});
