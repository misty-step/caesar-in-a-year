import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { submitReviewForUser } from '@/app/(app)/session/[sessionId]/actions';
import { consumeAiCall } from '@/lib/rateLimit/inMemoryRateLimit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);

    const sessionId = body?.sessionId;
    const itemIndex = body?.itemIndex;
    const userInput = body?.userInput;
    const tzOffsetMin = typeof body?.tzOffsetMin === 'number' ? body.tzOffsetMin : undefined;

    if (typeof sessionId !== 'string' || typeof itemIndex !== 'number' || typeof userInput !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Check rate limit before calling AI
    const rateLimitDecision = consumeAiCall(userId, Date.now());

    const token = await getToken({ template: 'convex' });
    const result = await submitReviewForUser({
      userId,
      sessionId,
      itemIndex,
      userInput,
      token: token ?? undefined,
      tzOffsetMin,
      aiAllowed: rateLimitDecision.allowed,
    });

    return NextResponse.json(
      {
        ...result,
        rateLimit: {
          remaining: rateLimitDecision.remaining,
          resetAtMs: rateLimitDecision.resetAtMs,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/grade', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
