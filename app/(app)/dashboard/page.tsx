import { auth } from '@clerk/nextjs/server';

import { createDataAdapter } from '@/lib/data/adapter';
import type { ContentSeed, UserProgress as DataUserProgress } from '@/lib/data/types';

import { Hero } from '@/components/dashboard/Hero';
import { Stats, type UserProgressVM } from '@/components/dashboard/Stats';
import { MasteryProgress } from '@/components/dashboard/MasteryProgress';
import { JustCompletedBanner } from '@/components/dashboard/JustCompletedBanner';
import { SessionCard } from '@/components/dashboard/SessionCard';

export const dynamic = 'force-dynamic';

async function getDashboardData(userId: string, token?: string | null): Promise<{
  progress: UserProgressVM;
  maxDifficulty: number;
  masteredCount: number;
  summary: {
    reviewCount: number;
    readingTitle: string;
  };
}> {
  const data = createDataAdapter(token ?? undefined);

  const [rawProgress, content] = await Promise.all([
    data.getUserProgress(userId),
    data.getContent(userId),
  ]);

  const maxDifficulty = rawProgress?.maxDifficulty ?? 10;

  // Fetch mastery count for current level
  const masteredCount = await data.getMasteredAtLevel(userId, maxDifficulty);

  const progress = mapProgress(rawProgress);
  const summary = mapContentToSummary(content);

  return { progress, maxDifficulty, masteredCount, summary };
}

function mapProgress(progress: DataUserProgress | null): UserProgressVM {
  if (!progress) {
    return {
      currentDay: 1,
      streak: 0,
      totalXp: 0,
      unlockedPhase: 1,
    };
  }

  return {
    currentDay: Math.max(1, progress.maxDifficulty),
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
  const { progress, maxDifficulty, masteredCount, summary } = await getDashboardData(userId, token);

  // Detect if user just completed a session (within last 60 seconds)
  const justCompleted = progress.lastSessionAt
    ? Date.now() - progress.lastSessionAt < 60_000
    : false;

  return (
    <main className="min-h-screen bg-roman-50 text-roman-900">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <Hero />

        {justCompleted && <JustCompletedBanner />}

        <Stats progress={progress} reviewCount={summary.reviewCount} readingTitle={summary.readingTitle} justCompleted={justCompleted} />

        <SessionCard justCompleted={justCompleted} />

        <MasteryProgress masteredCount={masteredCount} readingLevel={maxDifficulty} />
      </div>
    </main>
  );
}
