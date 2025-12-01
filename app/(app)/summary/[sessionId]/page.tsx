import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { createDataAdapter } from '@/lib/data/adapter';
import { SummaryCard } from '@/components/Session/SummaryCard';
import { Button } from '@/components/UI/Button';

export const dynamic = 'force-dynamic';

interface SummaryPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SummaryPage(props: SummaryPageProps) {
  const { userId } = await auth();

  // Middleware guarantees auth; this is defensive
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const { sessionId } = await props.params;
  const data = createDataAdapter();
  const session = await data.getSession(sessionId, userId);

  if (!session) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-roman-50 text-roman-900">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <SummaryCard session={session} />

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
