import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { cookies } from 'next/headers';

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
import { TimezoneSync } from '@/components/dashboard/TimezoneSync';

export const dynamic = 'force-dynamic';

const TZ_OFFSET_COOKIE_NAME = 'tzOffsetMin';
const MIN_TZ_OFFSET_MIN = -720;
const MAX_TZ_OFFSET_MIN = 720;

async function parseTimezoneOffsetFromCookie(): Promise<number> {
  const cookieStore = await cookies();
  const rawOffset = cookieStore.get(TZ_OFFSET_COOKIE_NAME)?.value;
  if (!rawOffset) {
    return 0;
  }

  const parsedOffset = Number.parseInt(rawOffset, 10);
  if (Number.isNaN(parsedOffset)) {
    return 0;
  }

  return Math.max(MIN_TZ_OFFSET_MIN, Math.min(MAX_TZ_OFFSET_MIN, parsedOffset));
}

/**
 * Auth configuration error component
 * Shows when Convex token is missing (Clerk JWT template not configured)
 */
function AuthConfigError(): React.JSX.Element {
  return (
    <main className="min-h-dvh bg-background text-text-primary flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center space-y-6">
        <div className="size-16 mx-auto rounded-card bg-warning-faint flex items-center justify-center">
          <svg className="size-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-serif text-text-primary">Authentication Error</h1>
          <p className="text-text-muted text-sm">
            Unable to connect to the database. This is a configuration issue, not a problem with your account.
          </p>
        </div>

        <div className="bg-surface p-4 rounded-lg text-left text-sm space-y-2">
          <p className="font-medium text-text-secondary">For administrators:</p>
          <ol className="list-decimal list-inside space-y-1 text-text-muted">
            <li>Check Clerk Dashboard → JWT Templates</li>
            <li>Verify &quot;convex&quot; template exists</li>
            <li>Check Convex Dashboard → Settings → Auth</li>
            <li>Verify Clerk provider is configured</li>
          </ol>
        </div>

        <a
          href="/dashboard"
          className="w-full block bg-accent text-white px-6 py-3 rounded-button font-medium hover:opacity-90 transition-opacity text-center"
        >
          Try Again
        </a>
      </div>
    </main>
  );
}

async function getDashboardData(userId: string, token: string | undefined, tzOffsetMin: number): Promise<{
  progress: UserProgressVM;
  metrics: ProgressMetrics;
  activeSession: Session | null;
  summary: {
    reviewCount: number;
    readingTitle: string;
  };
}> {
  const data = createDataAdapter(token ?? undefined);

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

  // Handle missing Convex token - report to Sentry and show user-friendly error
  if (!token && process.env.NODE_ENV === 'production') {
    Sentry.captureMessage('Dashboard: Convex token is null', {
      level: 'warning',
      tags: { component: 'dashboard', issue: 'missing_token' },
    });
    return <AuthConfigError />;
  }

  let progress: UserProgressVM;
  let metrics: ProgressMetrics;
  let summary: { reviewCount: number; readingTitle: string };
  let activeSession: Session | null;
  const tzOffsetMin = await parseTimezoneOffsetFromCookie();

  try {
    const data = await getDashboardData(userId, token ?? undefined, tzOffsetMin);
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
        <TimezoneSync />
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
