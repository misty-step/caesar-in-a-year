import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import type { JourneyProgress } from '@/lib/data/types';

/** View model for dashboard stats display */
export type UserProgressVM = {
  totalXp: number;
  streak: number;
  unlockedPhase: number;
  lastSessionAt?: number; // Unix ms - for detecting "just completed" state
};

interface StatsProps {
  progress: UserProgressVM;
  iter: JourneyProgress;
  reviewCount: number;
  readingTitle: string;
  justCompleted?: boolean;
}

function ScheduleIndicator({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="text-laurel-600 font-medium">
        ✓ On track
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="text-laurel-600 font-medium">
        ↑ {delta} {delta === 1 ? 'day' : 'days'} ahead
      </span>
    );
  }
  return (
    <span className="text-terracotta-600 font-medium">
      ↓ {Math.abs(delta)} {Math.abs(delta) === 1 ? 'day' : 'days'} behind
    </span>
  );
}

export function Stats({ progress, iter, reviewCount, readingTitle, justCompleted }: StatsProps) {
  // Milestone streaks get verdigris ring
  const isMilestone = progress.streak > 0 && progress.streak % 7 === 0;

  return (
    <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {/* Journey - spans 2 columns on larger screens */}
      <div className="col-span-2 bg-parchment rounded-card border border-slate-200 p-6 flex flex-col justify-between">
        <div className="space-y-3">
          <Label>
            <LatinText latin="Iter Tuum" english="Your Journey" />
          </Label>
          <h2 className="text-2xl font-serif text-ink">
            Day {iter.contentDay} of 365
          </h2>
          {iter.daysActive > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-ink-light">
                {iter.daysActive} {iter.daysActive === 1 ? 'day' : 'days'} active
              </p>
              <p className="text-xs">
                <ScheduleIndicator delta={iter.scheduleDelta} />
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Streak - visual anchor, taller */}
      <div className={`row-span-1 bg-parchment rounded-card border border-slate-200 p-6 flex flex-col items-center justify-center ${justCompleted ? 'ring-2 ring-verdigris-400 ring-offset-2' : ''} ${isMilestone && !justCompleted ? 'ring-2 ring-bronze-400 ring-offset-2' : ''}`}>
        <div className={`text-4xl font-serif text-tyrian-500 mb-1 ${justCompleted ? 'animate-stamp' : ''}`}>
          {progress.streak}
        </div>
        <Label className="text-center">
          <LatinText latin="Series Dierum" english="Day Streak" />
        </Label>
        {isMilestone && (
          <p className="text-xs text-bronze-600 mt-2 font-medium">
            <LatinText latin="Lapis miliarius!" english="Milestone!" />
          </p>
        )}
      </div>

      {/* Today's reading */}
      <div className="bg-parchment rounded-card border border-slate-200 p-6 space-y-2">
        <Label>
          <LatinText latin="Hodie" english="Today" />
        </Label>
        <p className="text-sm font-medium text-ink line-clamp-2">{readingTitle}</p>
        <p className="text-xs text-ink-light">
          <LatinText
            latin={`${reviewCount} recognoscendae`}
            english={`${reviewCount} to review`}
          />
        </p>
      </div>
    </section>
  );
}
