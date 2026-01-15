import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import { cn } from '@/lib/design';
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
      <span className="text-success font-medium">
        ✓ On track
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="text-success font-medium">
        ↑ {delta} {delta === 1 ? 'day' : 'days'} ahead
      </span>
    );
  }
  return (
    <span className="text-warning font-medium">
      ↓ {Math.abs(delta)} {Math.abs(delta) === 1 ? 'day' : 'days'} behind
    </span>
  );
}

/**
 * Dashboard stats grid showing journey progress, streak, and today's reading.
 *
 * Uses semantic tokens and Card component for consistent surface styling.
 */
export function Stats({ progress, iter, reviewCount, readingTitle, justCompleted }: StatsProps) {
  // Milestone streaks get achievement ring
  const isMilestone = progress.streak > 0 && progress.streak % 7 === 0;

  return (
    <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {/* Journey - spans 2 columns on larger screens */}
      <Card elevation="flat" padding="md" className="col-span-2 flex flex-col justify-between">
        <div className="space-y-3">
          <Label>
            <LatinText latin="Iter Tuum" english="Your Journey" />
          </Label>
          <h2 className="text-2xl font-serif text-text-primary">
            Day {iter.contentDay} of 365
          </h2>
          {iter.daysActive > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-text-secondary">
                {iter.daysActive} {iter.daysActive === 1 ? 'day' : 'days'} active
              </p>
              <p className="text-xs">
                <ScheduleIndicator delta={iter.scheduleDelta} />
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Streak - visual anchor, taller */}
      <Card
        elevation="flat"
        padding="md"
        className={cn(
          'row-span-1 flex flex-col items-center justify-center',
          justCompleted && 'ring-2 ring-celebration ring-offset-2',
          isMilestone && !justCompleted && 'ring-2 ring-achievement ring-offset-2'
        )}
      >
        <div className={cn(
          'text-4xl font-serif text-accent mb-1',
          justCompleted && 'animate-stamp'
        )}>
          {progress.streak}
        </div>
        <Label className="text-center">
          <LatinText latin="Series Dierum" english="Day Streak" />
        </Label>
        {isMilestone && (
          <p className="text-xs text-achievement mt-2 font-medium">
            <LatinText latin="Lapis miliarius!" english="Milestone!" />
          </p>
        )}
      </Card>

      {/* Today's reading */}
      <Card elevation="flat" padding="md" className="space-y-2">
        <Label>
          <LatinText latin="Hodie" english="Today" />
        </Label>
        <p className="text-sm font-medium text-text-primary line-clamp-2">{readingTitle}</p>
        <p className="text-xs text-text-secondary">
          <LatinText
            latin={`${reviewCount} recognoscendae`}
            english={`${reviewCount} to review`}
          />
        </p>
      </Card>
    </section>
  );
}
