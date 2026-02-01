import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { fetchQuery } from 'convex/nextjs';

import { api } from '@/convex/_generated/api';
import { createDataAdapter } from '@/lib/data/adapter';
import { buildSessionItems } from '@/lib/session/builder';

export const dynamic = 'force-dynamic';

export default async function NewSessionPage(): Promise<React.JSX.Element> {
  const { userId, getToken } = await auth();

  // Middleware guarantees auth; this is defensive
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const token = await getToken({ template: 'convex' });

  // Check billing access before creating session
  const billingStatus = await fetchQuery(
    api.billing.getStatus,
    {},
    token ? { token } : undefined
  );

  if (!billingStatus.hasAccess) {
    redirect('/subscribe');
  }

  const data = createDataAdapter(token ?? undefined);
  const activeSession = await data.getActiveSession();

  if (activeSession) {
    redirect(`/session/${activeSession.id}`);
  }

  const content = await data.getContent(userId);
  const items = buildSessionItems(content);
  const session = await data.createSession(userId, items);

  redirect(`/session/${session.id}`);
}
