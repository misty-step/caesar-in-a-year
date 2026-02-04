import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';

import { createDataAdapter, ConvexAuthError } from '@/lib/data/adapter';
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

  // Validate token presence - only report to Sentry in production
  // Dev mode uses in-memory adapter fallback, so null token is expected
  if (!token && process.env.NODE_ENV === 'production') {
    Sentry.setContext('auth', {
      userId,
      hasToken: false,
      environment: 'production',
    });
    Sentry.captureMessage('Dashboard: Convex token is null', {
      level: 'warning',
      tags: { component: 'dashboard', issue: 'missing_token' },
    });
  }

  let progress: UserProgressVM;
  let metrics: ProgressMetrics;
  let summary: { reviewCount: number; readingTitle: string };
  let activeSession: Session | null;
  try {
    const data = await getDashboardData(userId, token);
    progress = data.progress;
    metrics = data.metrics;
    summary = data.summary;
    activeSession = data.activeSession;
  } catch (error) {
    // Report to Sentry with full context
    Sentry.setContext('dashboard', {
      userId,
      hasToken: Boolean(token),
      tokenLength: token?.length,
    });

    if (error instanceof ConvexAuthError) {
      Sentry.setContext('convex_auth', error.context);
    }

    Sentry.captureException(error, {
      tags: { component: 'dashboard', operation: 'getDashboardData' },
    });

    // Re-throw to trigger error boundary
    throw error;
  }

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
