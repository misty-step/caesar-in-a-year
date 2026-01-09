'use client';

import { useState } from 'react';
import { LatinText } from '@/components/UI/LatinText';
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
  if (count === 0) return 'bg-roman-100';           // Empty - warm gray
  if (count <= 2) return 'bg-terracotta-100';       // Light terracotta
  if (count <= 5) return 'bg-terracotta-500';       // Medium terracotta
  if (count <= 10) return 'bg-terracotta-700';      // Dark terracotta
  return 'bg-pompeii-600';                          // Deep Pompeii red
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00'); // Parse as local time
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

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
    <section className="bg-marble rounded-xl border border-roman-200 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-roman-500">
          <LatinText latin="Studium Cotidianum" english="Daily Study" />
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-serif text-pompeii-600">{streak}</span>
          <span className="text-xs text-roman-500">
            <LatinText latin="dies" english="day streak" />
          </span>
        </div>
      </div>

      {/* Month labels */}
      <div className="relative">
        <div className="flex gap-0.5 text-xs text-roman-400 mb-1 ml-6">
          {monthLabels.map(({ month, colStart }, i) => (
            <span
              key={`${month}-${i}`}
              className="absolute"
              style={{ left: `${colStart * 12 + 24}px` }}
            >
              {month}
            </span>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex gap-0.5 overflow-x-auto pt-4">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 text-xs text-roman-400 pr-1">
          <span className="h-[10px]">M</span>
          <span className="h-[10px]"></span>
          <span className="h-[10px]">W</span>
          <span className="h-[10px]"></span>
          <span className="h-[10px]">F</span>
          <span className="h-[10px]"></span>
          <span className="h-[10px]"></span>
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day) => (
              <div
                key={day.date}
                className={`w-[10px] h-[10px] rounded-[2px] ${getIntensity(day.count)} transition-transform hover:scale-125 cursor-pointer`}
                onMouseEnter={(e) => setHovered({ day, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="fixed z-50 bg-roman-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg pointer-events-none animate-fade-in"
          style={{
            top: hovered.rect.top - 52,
            left: hovered.rect.left + hovered.rect.width / 2 - 60,
          }}
        >
          <p className="font-medium">{formatDisplayDate(hovered.day.date)}</p>
          <p className="text-roman-300">
            {hovered.day.count} {hovered.day.count === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-xs text-roman-400">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0, 2, 5, 10, 15].map((n, i) => (
            <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${getIntensity(n)}`} />
          ))}
        </div>
        <span>More</span>
      </div>
    </section>
  );
}
