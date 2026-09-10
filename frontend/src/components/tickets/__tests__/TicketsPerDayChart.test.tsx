import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { TicketsPerDayChart, DailyTicketCount } from '../TicketsPerDayChart';

describe('TicketsPerDayChart Component Tests', () => {
  const sampleData: DailyTicketCount[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 7, 12 + i));
    const count = i === 15 ? 10 : i === 5 ? 7 : i % 2 === 0 ? 3 : 0;
    return {
      date: d.toISOString().split('T')[0],
      formattedDate: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      count,
    };
  });

  const totalTicketsCalculated = sampleData.reduce((acc, d) => acc + d.count, 0);

  describe('1. Visual Rendering & Metrics Calculation', () => {
    it('renders the chart card container with title, description, and timeline header', () => {
      render(<TicketsPerDayChart data={sampleData} />);

      expect(screen.getByTestId('card-tickets-per-day')).toBeInTheDocument();
      expect(screen.getByText('Ticket Volume (Past 30 Days)')).toBeInTheDocument();
      expect(
        screen.getByText(/daily incoming support tickets and volume trend across the last 30 days/i)
      ).toBeInTheDocument();
      expect(screen.getByText('30-day timeline')).toBeInTheDocument();
    });

    it('calculates and displays total tickets, daily average, and peak day badge', () => {
      render(<TicketsPerDayChart data={sampleData} />);

      const totalBadge = screen.getByTestId('badge-total-30d');
      expect(totalBadge).toHaveTextContent(`${totalTicketsCalculated} tickets`);

      const avgBadge = screen.getByTestId('badge-avg-30d');
      const expectedAvg = (totalTicketsCalculated / 30).toFixed(1);
      expect(avgBadge).toHaveTextContent(`${expectedAvg} / day avg`);

      const peakBadge = screen.getByTestId('badge-peak-30d');
      expect(peakBadge).toHaveTextContent(/Peak: 10/i);
    });

    it('renders exactly 30 interactive bars corresponding to the 30-day window', () => {
      render(<TicketsPerDayChart data={sampleData} />);

      const chart = screen.getByTestId('daily-tickets-bar-chart');
      expect(chart).toBeInTheDocument();

      for (let i = 0; i < 30; i++) {
        const bar = screen.getByTestId(`bar-day-${i}`);
        expect(bar).toBeInTheDocument();
        expect(bar).toHaveAttribute('data-count', String(sampleData[i].count));
        expect(bar).toHaveAttribute('aria-label', `${sampleData[i].formattedDate}: ${sampleData[i].count} tickets`);
      }
    });

    it('renders X-axis date milestones (first day, intermediate days, and Today)', () => {
      render(<TicketsPerDayChart data={sampleData} />);

      expect(screen.getByText(sampleData[0].formattedDate)).toBeInTheDocument();
      expect(screen.getByText(sampleData[14].formattedDate)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Today \\(${sampleData[29].formattedDate}\\)`))).toBeInTheDocument();
    });
  });

  describe('2. Hover & Interaction States', () => {
    it('shows floating tooltip and updates active status bar when hovering over a bar', async () => {
      const user = userEvent.setup();
      render(<TicketsPerDayChart data={sampleData} />);

      // Peak bar is at index 15 with 10 tickets
      const peakBar = screen.getByTestId('bar-day-15');
      await user.hover(peakBar);

      // Tooltip appears
      const tooltip = screen.getByTestId('floating-tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('10 tickets');

      // Status text updates
      const hoverInfo = screen.getByTestId('hover-info');
      expect(hoverInfo).toHaveTextContent(/10 tickets/i);
      expect(hoverInfo).toHaveTextContent(/% of 30-day volume/i);
    });

    it('removes floating tooltip and reverts status bar when cursor leaves the bar', async () => {
      const user = userEvent.setup();
      render(<TicketsPerDayChart data={sampleData} />);

      const bar = screen.getByTestId('bar-day-10');
      await user.hover(bar);
      expect(screen.getByTestId('floating-tooltip')).toBeInTheDocument();

      await user.unhover(bar);
      expect(screen.queryByTestId('floating-tooltip')).not.toBeInTheDocument();
      expect(
        screen.getByText(/hover or tap any bar to inspect daily ticket counts/i)
      ).toBeInTheDocument();
    });

    it('supports keyboard accessibility via focus and blur', async () => {
      render(<TicketsPerDayChart data={sampleData} />);

      const bar = screen.getByTestId('bar-day-5');
      fireEvent.focus(bar);

      expect(screen.getByTestId('floating-tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('hover-info')).toHaveTextContent('7 tickets');

      fireEvent.blur(bar);
      expect(screen.queryByTestId('floating-tooltip')).not.toBeInTheDocument();
    });
  });

  describe('3. Loading and Empty Fallback States', () => {
    it('renders animated skeleton bars when loading is true', () => {
      render(<TicketsPerDayChart data={sampleData} loading={true} />);

      expect(screen.getByTestId('chart-loading-skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('daily-tickets-bar-chart')).not.toBeInTheDocument();
    });

    it('gracefully generates fallback 30-day timeline with 0 counts when data is empty', () => {
      render(<TicketsPerDayChart data={[]} />);

      expect(screen.getByTestId('daily-tickets-bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('badge-total-30d')).toHaveTextContent('0 tickets');
      expect(screen.getByTestId('badge-avg-30d')).toHaveTextContent('0.0 / day avg');

      // Peak badge should not render when max count is 0
      expect(screen.queryByTestId('badge-peak-30d')).not.toBeInTheDocument();

      // All 30 bars should still exist with 0 count
      for (let i = 0; i < 30; i++) {
        expect(screen.getByTestId(`bar-day-${i}`)).toHaveAttribute('data-count', '0');
      }
    });

    it('gracefully handles undefined data prop without errors', () => {
      render(<TicketsPerDayChart />);

      expect(screen.getByTestId('card-tickets-per-day')).toBeInTheDocument();
      expect(screen.getByTestId('badge-total-30d')).toHaveTextContent('0 tickets');
    });
  });
});
