import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';

import { createDataAdapter } from '@/lib/data/adapter';
import { SessionClient } from '@/components/session/SessionClient';

export const dynamic = 'force-dynamic';

interface SessionPageProps {
  params: { sessionId: string };
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const data = createDataAdapter();
  const session = await data.getSession(params.sessionId, userId);

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
