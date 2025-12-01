import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { submitReviewForUser } from '@/app/(app)/session/[sessionId]/actions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);

    const sessionId = body?.sessionId;
    const itemIndex = body?.itemIndex;
    const userInput = body?.userInput;

    if (typeof sessionId !== 'string' || typeof itemIndex !== 'number' || typeof userInput !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const result = await submitReviewForUser({ userId, sessionId, itemIndex, userInput });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/grade', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
