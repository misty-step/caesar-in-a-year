'use server';

import { auth } from '@clerk/nextjs/server';
import { createDataAdapter } from '@/lib/data/adapter';
import { gradeTranslation } from '@/lib/ai/gradeTranslation';
import { advanceSession } from '@/lib/session/advance';
import type { GradingResult } from '@/types';
import type { SessionStatus } from '@/lib/data/types';

export type SubmitReviewInput = {
  sessionId: string;
  itemIndex: number;
  userInput: string;
};

export type SubmitReviewResult = {
  result: GradingResult;
  nextIndex: number;
  status: SessionStatus;
};

/**
 * Server action entrypoint: infers user from Clerk auth, then delegates.
 */
export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const { userId, getToken } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const token = await getToken({ template: 'convex' });
  return submitReviewForUser({ ...input, userId, token: token ?? undefined });
}

/**
 * Core grading + session-advance flow, shared by server actions and API routes.
 */
export async function submitReviewForUser(params: SubmitReviewInput & { userId: string; token?: string }): Promise<SubmitReviewResult> {
  const { userId, sessionId, itemIndex, userInput, token } = params;

  const data = createDataAdapter(token);
  const session = await data.getSession(sessionId, userId);

  if (!session) {
    throw new Error('Session not found');
  }

  const item = session.items[itemIndex];

  if (!item) {
    throw new Error('Invalid session item');
  }

  const result = await gradeTranslation(
    item.type === 'REVIEW'
      ? {
          latin: item.sentence.latin,
          userTranslation: userInput,
          reference: item.sentence.referenceTranslation,
          context: item.sentence.context,
        }
      : {
          latin: item.reading.latinText.join(' '),
          userTranslation: userInput,
          reference: item.reading.referenceGist,
          context: 'The user is summarizing a new passage.',
        },
  );

  await data.recordAttempt({
    sessionId: session.id,
    itemId: item.type === 'REVIEW' ? item.sentence.id : item.reading.id,
    type: item.type,
    userInput,
    gradingResult: result,
    createdAt: new Date().toISOString(),
  });

  const advanced = advanceSession(session);

  const updated = await data.advanceSession({
    sessionId: session.id,
    userId,
    nextIndex: advanced.nextIndex,
    status: advanced.status,
  });

  return {
    result,
    nextIndex: updated.currentIndex,
    status: updated.status,
  };
}

export type AdvanceSessionResult = {
  nextIndex: number;
  status: SessionStatus;
};

export async function advanceSessionForUser(params: {
  userId: string;
  sessionId: string;
  token?: string;
}): Promise<AdvanceSessionResult> {
  const { userId, sessionId, token } = params;

  const data = createDataAdapter(token);
  const session = await data.getSession(sessionId, userId);

  if (!session) {
    throw new Error('Session not found');
  }

  const advanced = advanceSession(session);

  const updated = await data.advanceSession({
    sessionId: session.id,
    userId,
    nextIndex: advanced.nextIndex,
    status: advanced.status,
  });

  return {
    nextIndex: updated.currentIndex,
    status: updated.status,
  };
}
