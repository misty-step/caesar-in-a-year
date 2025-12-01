import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';

import { createDataAdapter } from '@/lib/data/adapter';
import { SessionClient } from '@/components/Session/SessionClient';

export const dynamic = 'force-dynamic';

interface SessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage(props: SessionPageProps) {
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
      <div className="mx-auto max-w-5xl px-6 py-10">
        <SessionClient
          sessionId={session.id}
          items={session.items}
          initialIndex={session.currentIndex}
          initialStatus={session.status}
        />
      </div>
    </main>
  );
}
