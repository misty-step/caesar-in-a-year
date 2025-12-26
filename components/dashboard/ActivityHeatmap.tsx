'use client';

import { LatinText } from '@/components/UI/LatinText';
import type { ActivityDay } from '@/lib/data/types';

interface ActivityHeatmapProps {
  activity: ActivityDay[];
  streak: number;
}

function getIntensity(count: number): string {
  if (count === 0) return 'bg-roman-100';
  if (count <= 2) return 'bg-green-200';
  if (count <= 5) return 'bg-green-400';
  if (count <= 10) return 'bg-green-500';
  return 'bg-green-600';
}

export function ActivityHeatmap({ activity, streak }: ActivityHeatmapProps) {
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
    <section className="bg-white rounded-xl shadow-sm border border-roman-200 p-6 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-roman-500">
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
        <div className="flex gap-0.5 text-[10px] text-roman-400 mb-1 ml-6">
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
        <div className="flex flex-col gap-0.5 text-[10px] text-roman-400 pr-1">
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
                className={`w-[10px] h-[10px] rounded-[2px] ${getIntensity(day.count)}`}
                title={`${day.date}: ${day.count} reviews`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-[10px] text-roman-400">
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
