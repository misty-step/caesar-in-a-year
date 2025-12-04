import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

import { createDataAdapter } from '@/lib/data/adapter';
import { buildSessionItems } from '@/lib/session/builder';

export const dynamic = 'force-dynamic';

export default async function NewSessionPage() {
  const { userId, getToken } = await auth();

  // Middleware guarantees auth; this is defensive
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const token = await getToken({ template: 'convex' });
  const data = createDataAdapter(token ?? undefined);
  const content = await data.getContent();
  const items = buildSessionItems(content);
  const session = await data.createSession(userId, items);

  redirect(`/session/${session.id}`);
}
