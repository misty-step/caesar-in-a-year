import { LatinText } from '@/components/UI/LatinText';
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
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="bg-marble rounded-xl border border-roman-200 p-6 flex flex-col justify-between">
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-eyebrow text-roman-500">
            <LatinText latin="Iter Tuum" english="Your Journey" />
          </span>
          <h2 className="text-2xl font-serif text-roman-900">
            Day {iter.contentDay} of 365
          </h2>
          {iter.daysActive > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-roman-600">
                {iter.daysActive} {iter.daysActive === 1 ? 'day' : 'days'} active
              </p>
              <p className="text-xs">
                <ScheduleIndicator delta={iter.scheduleDelta} />
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={`bg-marble rounded-xl border border-roman-200 p-6 flex flex-col items-center justify-center ${justCompleted ? 'ring-2 ring-pompeii-400 ring-offset-2' : ''}`}>
        <div className={`text-4xl font-serif text-pompeii-600 mb-1 ${justCompleted ? 'animate-bounce-in' : ''}`}>
          {progress.streak}
        </div>
        <span className="text-xs uppercase text-roman-400 font-semibold tracking-eyebrow">
          <LatinText latin="Series Dierum" english="Day Streak" />
        </span>
      </div>

      <div className="bg-marble rounded-xl border border-roman-200 p-6 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-eyebrow text-roman-500">
          <LatinText latin="Quid Hodie Legis?" english="What do you read today?" />
        </span>
        <p className="text-sm font-medium text-roman-900">{readingTitle}</p>
        <p className="text-xs text-roman-600">
          <LatinText
            latin={`Sententiae recognoscendae: ${reviewCount}`}
            english={`Sentences to review: ${reviewCount}`}
          />
        </p>
      </div>
    </section>
  );
}
