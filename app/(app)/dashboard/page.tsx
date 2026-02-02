import { auth } from '@clerk/nextjs/server';

import { createDataAdapter } from '@/lib/data/adapter';
import type { ContentSeed, ProgressMetrics, Session, UserProgress as DataUserProgress } from '@/lib/data/types';
import { getCurrentStreak } from '@/lib/progress/streak';

import { Hero } from '@/components/dashboard/Hero';
import { Stats, type UserProgressVM } from '@/components/dashboard/Stats';
import { JustCompletedBanner } from '@/components/dashboard/JustCompletedBanner';
import { SessionCard } from '@/components/dashboard/SessionCard';
import { LegionStatus } from '@/components/dashboard/LegionStatus';
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap';
import { JourneyProgress } from '@/components/dashboard/JourneyProgress';
import { XPDisplay } from '@/components/dashboard/XPDisplay';
import { TrialBanner } from '@/components/dashboard/TrialBanner';

export const dynamic = 'force-dynamic';

async function getDashboardData(userId: string, token?: string | null): Promise<{
  progress: UserProgressVM;
  metrics: ProgressMetrics;
  activeSession: Session | null;
  summary: {
    reviewCount: number;
    readingTitle: string;
  };
}> {
  const data = createDataAdapter(token ?? undefined);

  // TODO: Read timezone from cookie for proper local date display
  // For now, default to UTC (offset 0). User sessions will still be
  // attributed to the correct day relative to UTC.
  const tzOffsetMin = 0;

  const [rawProgress, content, metrics, activeSession] = await Promise.all([
    data.getUserProgress(userId),
    data.getContent(userId),
    data.getProgressMetrics(userId, tzOffsetMin),
    data.getActiveSession(),
  ]);

  const progress = mapProgress(rawProgress, tzOffsetMin);
  const summary = mapContentToSummary(content);

  return { progress, metrics, activeSession, summary };
}

function mapProgress(progress: DataUserProgress | null, tzOffsetMin: number): UserProgressVM {
  if (!progress) {
    return {
      streak: 0,
      totalXp: 0,
      unlockedPhase: 1,
    };
  }

  const effectiveStreak = getCurrentStreak({
    streak: progress.streak,
    lastSessionAtMs: progress.lastSessionAt,
    nowMs: Date.now(),
    tzOffsetMin,
  });

  return {
    streak: effectiveStreak,
    totalXp: progress.totalXp,
    unlockedPhase: progress.maxDifficulty,
    lastSessionAt: progress.lastSessionAt,
  };
}

function mapContentToSummary(content: ContentSeed) {
  return {
    reviewCount: content.review.length,
    readingTitle: content.reading.title,
  };
}

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const { userId, getToken } = await auth();

  // Middleware guarantees auth; this is defensive
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const token = await getToken({ template: 'convex' });
  const { progress, metrics, summary, activeSession } = await getDashboardData(userId, token);

  // Detect if user just completed a session (within last 60 seconds)
  const justCompleted = progress.lastSessionAt
    ? Date.now() - progress.lastSessionAt < 60_000
    : false;

  return (
    <main className="min-h-dvh bg-background text-text-primary">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <Hero />

        {justCompleted && <JustCompletedBanner />}

        <TrialBanner />

        <Stats progress={progress} iter={metrics.iter} reviewCount={summary.reviewCount} readingTitle={summary.readingTitle} justCompleted={justCompleted} />

        <SessionCard justCompleted={justCompleted} activeSession={activeSession} />

        {/* Progress Visualization */}
        <div className="grid gap-6 md:grid-cols-2">
          <LegionStatus legion={metrics.legion} />
          <XPDisplay xp={metrics.xp} />
        </div>

        <JourneyProgress iter={metrics.iter} />

        <ActivityHeatmap activity={metrics.activity} streak={metrics.streak} />
      </div>
    </main>
  );
}
