import { auth } from '@clerk/nextjs/server';

import { createDataAdapter } from '@/lib/data/adapter';
import type { ContentSeed, ProgressMetrics, UserProgress as DataUserProgress } from '@/lib/data/types';

import { Hero } from '@/components/dashboard/Hero';
import { Stats, type UserProgressVM } from '@/components/dashboard/Stats';
import { JustCompletedBanner } from '@/components/dashboard/JustCompletedBanner';
import { SessionCard } from '@/components/dashboard/SessionCard';
import { LegionStatus } from '@/components/dashboard/LegionStatus';
import { ActivityHeatmap } from '@/components/dashboard/ActivityHeatmap';
import { JourneyProgress } from '@/components/dashboard/JourneyProgress';
import { XPDisplay } from '@/components/dashboard/XPDisplay';

export const dynamic = 'force-dynamic';

async function getDashboardData(userId: string, token?: string | null): Promise<{
  progress: UserProgressVM;
  metrics: ProgressMetrics;
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

  const [rawProgress, content, metrics] = await Promise.all([
    data.getUserProgress(userId),
    data.getContent(userId),
    data.getProgressMetrics(userId, tzOffsetMin),
  ]);

  const progress = mapProgress(rawProgress);
  const summary = mapContentToSummary(content);

  return { progress, metrics, summary };
}

function mapProgress(progress: DataUserProgress | null): UserProgressVM {
  if (!progress) {
    return {
      streak: 0,
      totalXp: 0,
      unlockedPhase: 1,
    };
  }

  return {
    streak: progress.streak,
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

export default async function DashboardPage() {
  const { userId, getToken } = await auth();

  // Middleware guarantees auth; this is defensive
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const token = await getToken({ template: 'convex' });
  const { progress, metrics, summary } = await getDashboardData(userId, token);

  // Detect if user just completed a session (within last 60 seconds)
  const justCompleted = progress.lastSessionAt
    ? Date.now() - progress.lastSessionAt < 60_000
    : false;

  return (
    <main className="min-h-screen bg-roman-50 text-roman-900">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <Hero />

        {justCompleted && <JustCompletedBanner />}

        <Stats progress={progress} iter={metrics.iter} reviewCount={summary.reviewCount} readingTitle={summary.readingTitle} justCompleted={justCompleted} />

        <SessionCard justCompleted={justCompleted} />

        {/* New Progress Visualization */}
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
