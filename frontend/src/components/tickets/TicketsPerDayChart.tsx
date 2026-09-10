import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Calendar, Activity, Ticket } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface DailyTicketCount {
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "Aug 12"
  count: number;
}

export interface TicketsPerDayChartProps {
  data?: DailyTicketCount[];
  loading?: boolean;
}

/**
 * Generates fallback 30-day timeline when backend data is pending or empty.
 */
function generateFallback30Days(): DailyTicketCount[] {
  const days: DailyTicketCount[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i, 0, 0, 0, 0));
    days.push({
      date: d.toISOString().split('T')[0],
      formattedDate: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      count: 0,
    });
  }
  return days;
}

export function TicketsPerDayChart({ data, loading = false }: TicketsPerDayChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Normalize data to always ensure 30 days
  const chartData = useMemo(() => {
    if (data && data.length > 0) {
      return data;
    }
    return generateFallback30Days();
  }, [data]);

  // Key metrics over the 30-day window
  const { totalTickets, maxCount, peakDay, dailyAverage } = useMemo(() => {
    let total = 0;
    let max = 0;
    let peak: DailyTicketCount | null = null;

    for (const item of chartData) {
      total += item.count;
      if (item.count > max) {
        max = item.count;
        peak = item;
      }
    }

    const avg = chartData.length > 0 ? (total / chartData.length).toFixed(1) : '0.0';
    return {
      totalTickets: total,
      maxCount: Math.max(max, 1), // Avoid division by zero
      peakDay: peak,
      dailyAverage: avg,
    };
  }, [chartData]);

  // Current active day (either hovered or null)
  const activeItem = hoveredIndex !== null ? chartData[hoveredIndex] : null;

  // Format full date display for tooltip / active indicator
  const formatFullDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(Date.UTC(year, month - 1, day));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card
      className="border-border bg-card shadow-xs"
      data-testid="card-tickets-per-day"
      aria-label="Ticket volume bar chart over past 30 days"
    >
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Ticket Volume (Past 30 Days)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Daily incoming support tickets and volume trend across the last 30 days
            </CardDescription>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="text-xs font-semibold py-1 px-2.5 gap-1.5"
              data-testid="badge-total-30d"
            >
              <Ticket className="w-3.5 h-3.5 text-primary" />
              <span>{totalTickets} tickets</span>
            </Badge>

            <Badge
              variant="outline"
              className="text-xs font-semibold py-1 px-2.5 gap-1.5"
              data-testid="badge-avg-30d"
            >
              <Activity className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{dailyAverage} / day avg</span>
            </Badge>

            {peakDay && peakDay.count > 0 && (
              <Badge
                variant="outline"
                className="text-xs font-semibold py-1 px-2.5 gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                data-testid="badge-peak-30d"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Peak: {peakDay.count} ({peakDay.formattedDate})</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Dynamic Hover Status Bar */}
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground min-h-[24px]">
          {activeItem ? (
            <div className="flex items-center gap-2 text-foreground" data-testid="hover-info">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold">{formatFullDate(activeItem.date)}:</span>
              <span className="font-bold text-primary">
                {activeItem.count} {activeItem.count === 1 ? 'ticket' : 'tickets'}
              </span>
              {totalTickets > 0 && (
                <span className="text-muted-foreground text-[11px]">
                  ({((activeItem.count / totalTickets) * 100).toFixed(1)}% of 30-day volume)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Hover or tap any bar to inspect daily ticket counts</span>
            </div>
          )}

          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            30-day timeline
          </span>
        </div>
      </CardHeader>

      <CardContent className="pt-2 pb-6">
        {loading ? (
          /* Loading Skeleton State */
          <div className="space-y-4" data-testid="chart-loading-skeleton">
            <div className="h-48 sm:h-56 flex items-end gap-1 sm:gap-1.5 pt-6 pb-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-muted animate-pulse rounded-t-sm"
                  style={{
                    height: `${Math.max(15, Math.floor(Math.sin(i / 3) * 40 + 50))}%`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
              <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              <div className="h-3 w-12 bg-muted animate-pulse rounded" />
              <div className="h-3 w-12 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ) : (
          /* Main Interactive Bar Chart */
          <div className="relative" data-testid="daily-tickets-bar-chart">
            {/* Chart Area with Y-axis grid guidelines */}
            <div className="h-48 sm:h-56 flex relative pb-6">
              {/* Y-axis Reference Guidelines */}
              <div className="absolute inset-x-0 top-0 bottom-6 pointer-events-none flex flex-col justify-between">
                <div className="border-b border-border opacity-30 w-full flex items-center justify-between text-[10px] text-muted-foreground pr-1">
                  <span>{maxCount}</span>
                </div>
                <div className="border-b border-dashed border-border opacity-25 w-full flex items-center justify-between text-[10px] text-muted-foreground pr-1">
                  <span>{Math.round(maxCount / 2)}</span>
                </div>
                <div className="border-b border-border opacity-30 w-full flex items-center justify-between text-[10px] text-muted-foreground pr-1">
                  <span>0</span>
                </div>
              </div>

              {/* Bars flex row */}
              <div
                className="relative z-10 w-full h-full flex items-end gap-1 sm:gap-1.5"
                role="region"
                aria-label="Daily ticket bars"
              >
                {chartData.map((item, index) => {
                  const isHovered = hoveredIndex === index;
                  const isPeak = peakDay && item.count === peakDay.count && item.count > 0;
                  const heightPercent =
                    item.count > 0
                      ? Math.max(Math.round((item.count / maxCount) * 100), 8)
                      : 0;

                  return (
                    <div
                      key={item.date}
                      className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer relative"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onFocus={() => setHoveredIndex(index)}
                      onBlur={() => setHoveredIndex(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${item.formattedDate}: ${item.count} tickets`}
                      data-testid={`bar-day-${index}`}
                      data-date={item.date}
                      data-count={item.count}
                    >
                      {/* Floating Tooltip directly above bar when hovered */}
                      {isHovered && (
                        <div
                          className="absolute -top-9 z-30 px-2 py-1 bg-popover text-popover-foreground text-[11px] font-semibold rounded-md shadow-md border border-border pointer-events-none whitespace-nowrap animate-in fade-in-0 zoom-in-95"
                          data-testid="floating-tooltip"
                        >
                          <span className="text-primary font-bold">{item.count}</span>{' '}
                          {item.count === 1 ? 'ticket' : 'tickets'}
                        </div>
                      )}

                      {/* Bar Pillar */}
                      {item.count > 0 ? (
                        <div
                          className={`w-full rounded-t-sm min-h-[8px] transition-all duration-200 ${
                            isHovered
                              ? 'bg-primary opacity-100 ring-2 ring-primary shadow-sm'
                              : isPeak
                              ? 'bg-amber-500 hover:bg-amber-600 opacity-100'
                              : 'bg-primary opacity-80 hover:opacity-100'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      ) : (
                        /* Zero tickets base marker */
                        <div
                          className={`w-full h-1 min-h-[3px] rounded-full transition-all duration-200 ${
                            isHovered
                              ? 'bg-primary opacity-100 ring-1 ring-primary'
                              : 'bg-muted-foreground opacity-30 hover:opacity-70'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis Timeline Labels (spaced cleanly across 30 days) */}
            <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-border">
              <span>{chartData[0]?.formattedDate}</span>
              <span className="hidden sm:inline">{chartData[7]?.formattedDate}</span>
              <span>{chartData[14]?.formattedDate}</span>
              <span className="hidden sm:inline">{chartData[21]?.formattedDate}</span>
              <span className="font-medium text-foreground">
                Today ({chartData[chartData.length - 1]?.formattedDate})
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TicketsPerDayChart;
