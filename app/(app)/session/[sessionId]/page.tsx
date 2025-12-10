import { auth } from '@clerk/nextjs/server';
import { notFound } from 'next/navigation';

import { createDataAdapter } from '@/lib/data/adapter';
import { normalizeSessionId } from '@/lib/session/id';
import { SessionClient } from '@/components/Session/SessionClient';

export const dynamic = 'force-dynamic';

interface SessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage(props: SessionPageProps) {
  const { userId, getToken } = await auth();

  // Middleware guarantees auth; this is defensive
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const { sessionId: rawSessionId } = await props.params;
  const sessionId = normalizeSessionId(rawSessionId);
  const token = await getToken({ template: 'convex' });

  console.log(`[SessionPage] Loading session ${sessionId}, token: ${token ? 'present' : 'MISSING'}`);

  const data = createDataAdapter(token ?? undefined);
  let session = await data.getSession(sessionId, userId);

  // Retry once with fresh token if session not found (token may have been stale)
  if (!session && token) {
    console.warn(`[SessionPage] Session ${sessionId} not found, retrying with fresh token`);
    const freshToken = await getToken({ template: 'convex' });
    if (freshToken) {
      const freshData = createDataAdapter(freshToken);
      session = await freshData.getSession(sessionId, userId);
    }
  }

  if (!session) {
    console.error(`[SessionPage] Session ${sessionId} not found after retry`);
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
