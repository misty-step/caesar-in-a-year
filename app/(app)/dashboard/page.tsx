import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';

import { createDataAdapter } from '@/lib/data/adapter';
import type { ContentSeed, UserProgress as DataUserProgress } from '@/lib/data/types';

import { Hero } from '@/components/dashboard/Hero';
import { Stats, type UserProgressVM } from '@/components/dashboard/Stats';
import { MasteryProgress } from '@/components/dashboard/MasteryProgress';
import { Button } from '@/components/UI/Button';

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

  return (
    <main className="min-h-screen bg-roman-50 text-roman-900">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <Hero />

        <Stats progress={progress} reviewCount={summary.reviewCount} readingTitle={summary.readingTitle} />

        <section className="bg-white rounded-xl shadow-sm border border-roman-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-roman-500">
              Session
            </p>
            <h2 className="text-xl font-serif font-semibold text-roman-900">
              Ready for today&apos;s guided reading?
            </h2>
            <p className="text-sm text-roman-700">
              You&apos;ll review key sentences, then tackle a short passage with glossary support.
            </p>
          </div>
          <div className="flex justify-end">
            <Link href="/session/new">
              <Button className="w-full sm:w-auto text-base px-8 py-3" labelLatin="Incipe Sessionem" labelEnglish="Start Session" />
            </Link>
          </div>
        </section>

        <MasteryProgress masteredCount={masteredCount} readingLevel={maxDifficulty} />
      </div>
    </main>
  );
}
