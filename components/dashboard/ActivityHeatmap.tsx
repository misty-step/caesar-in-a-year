'use client';

import { useState } from 'react';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import { cn } from '@/lib/design';
import type { ActivityDay } from '@/lib/data/types';

interface ActivityHeatmapProps {
  activity: ActivityDay[];
  streak: number;
}

interface HoveredState {
  day: ActivityDay;
  rect: DOMRect;
}

function getIntensity(count: number): string {
  if (count === 0) return 'bg-border';
  if (count <= 2) return 'bg-accent-faint';
  if (count <= 5) return 'bg-accent-light/50';
  if (count <= 10) return 'bg-accent';
  return 'bg-accent-hover';
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Activity heatmap showing daily study patterns.
 *
 * Uses semantic tokens for intensity levels (accent scale).
 */
export function ActivityHeatmap({ activity, streak }: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<HoveredState | null>(null);

  // Group by week (7 days per column)
  const weeks: ActivityDay[][] = [];
  for (let i = 0; i < activity.length; i += 7) {
    weeks.push(activity.slice(i, i + 7));
  }

  // Get month labels from activity data
  const monthLabels: { month: string; colStart: number }[] = [];
  let lastMonth = '';
  activity.forEach((day, i) => {
    const month = new Date(day.date).toLocaleDateString('en-US', { month: 'short' });
    if (month !== lastMonth) {
      monthLabels.push({ month, colStart: Math.floor(i / 7) });
      lastMonth = month;
    }
  });

  return (
    <Card as="section" elevation="flat" padding="md" className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>
          <LatinText latin="Studium Cotidianum" english="Daily Study" />
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-serif text-accent">{streak}</span>
          <span className="text-xs text-text-muted">
            <LatinText latin="dies" english="day streak" />
          </span>
        </div>
      </div>

      {/* Month labels */}
      <div className="relative">
        <div className="flex gap-0.5 text-xs text-text-faint mb-1 ml-6">
          {monthLabels.map(({ month, colStart }, i) => (
            <span
              key={`${month}-${i}`}
              className="absolute"
              style={{ left: `${colStart * 14 + 24}px` }}
            >
              {month}
            </span>
          ))}
        </div>
      </div>

      {/* Grid - larger touch targets for mobile */}
      <div className="flex gap-1 overflow-x-auto pt-4">
        {/* Day labels */}
        <div className="flex flex-col gap-1 text-xs text-text-faint pr-1">
          <span className="h-3">M</span>
          <span className="h-3"></span>
          <span className="h-3">W</span>
          <span className="h-3"></span>
          <span className="h-3">F</span>
          <span className="h-3"></span>
          <span className="h-3"></span>
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <button
                key={day.date}
                className={cn(
                  'size-3 rounded-sm transition-transform hover:scale-125 focus:scale-125',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent touch-manipulation',
                  getIntensity(day.count)
                )}
                onMouseEnter={(e) => setHovered({ day, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHovered(null)}
                onFocus={(e) => setHovered({ day, rect: e.currentTarget.getBoundingClientRect() })}
                onBlur={() => setHovered(null)}
                aria-label={`${formatDisplayDate(day.date)}: ${day.count} reviews`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="fixed z-50 bg-text-primary text-text-inverse px-3 py-2 rounded-lg text-sm shadow-lg pointer-events-none animate-fade-in"
          style={{
            top: Math.max(8, hovered.rect.top - 52),
            left: Math.max(8, Math.min(hovered.rect.left + hovered.rect.width / 2 - 60, window.innerWidth - 128)),
          }}
        >
          <p className="font-medium">{formatDisplayDate(hovered.day.date)}</p>
          <p className="text-text-on-inverted-muted">
            {hovered.day.count} {hovered.day.count === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-xs text-text-faint">
        <span>Less</span>
        <div className="flex gap-1">
          {[0, 2, 5, 10, 15].map((n, i) => (
            <div key={i} className={cn('size-3 rounded-sm', getIntensity(n))} />
          ))}
        </div>
        <span>More</span>
      </div>
    </Card>
  );
}
