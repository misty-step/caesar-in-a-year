import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { createDataAdapter } from '@/lib/data/adapter';
import { SummaryClient } from './SummaryClient';
import { Button } from '@/components/UI/Button';

export const dynamic = 'force-dynamic';

const MASTERY_THRESHOLD = 20;
const LEVEL_INCREMENT = 5;
const MAX_LEVEL = 100;

interface SummaryPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ levelUp?: string }>;
}

export default async function SummaryPage(props: SummaryPageProps) {
  const { userId, getToken } = await auth();

  // Middleware guarantees auth; this is defensive
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const { sessionId } = await props.params;
  const searchParams = await props.searchParams;
  const token = await getToken({ template: 'convex' });
  const data = createDataAdapter(token ?? undefined);
  const session = await data.getSession(sessionId, userId);

  if (!session) {
    notFound();
  }

  // Skip mastery check if already processed (levelUp param present)
  if (!searchParams.levelUp && session.status === 'complete') {
    const userProgress = await data.getUserProgress(userId);
    const maxDifficulty = userProgress?.maxDifficulty ?? 10;

    if (maxDifficulty < MAX_LEVEL) {
      const masteredCount = await data.getMasteredAtLevel(userId, maxDifficulty);

      if (masteredCount >= MASTERY_THRESHOLD) {
        const newLevel = Math.min(maxDifficulty + LEVEL_INCREMENT, MAX_LEVEL);
        await data.incrementDifficulty(userId, LEVEL_INCREMENT);
        redirect(`/summary/${sessionId}?levelUp=${maxDifficulty}-${newLevel}`);
      }
    }
  }

  return (
    <main className="min-h-screen bg-roman-50 text-roman-900">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <SummaryClient session={session} levelUpParam={searchParams.levelUp} />

        <div className="flex justify-between pt-4">
          <Link href="/dashboard">
            <Button variant="outline" labelLatin="Ad Tabulam" labelEnglish="Back to Dashboard" />
          </Link>
          <Link href="/session/new">
            <Button labelLatin="Iterum Exercere" labelEnglish="Start Another Session" />
          </Link>
        </div>
      </div>
    </main>
  );
}
