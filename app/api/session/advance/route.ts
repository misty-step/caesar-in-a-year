import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { advanceSessionForUser } from '@/app/(app)/session/[sessionId]/actions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);

    const sessionId = body?.sessionId;

    if (typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const result = await advanceSessionForUser({ userId, sessionId });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/session/advance', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
