'use server';

import { auth } from '@clerk/nextjs/server';
import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { createDataAdapter } from '@/lib/data/adapter';
import { normalizeSessionId } from '@/lib/session/id';
import { gradeTranslation } from '@/lib/ai/gradeTranslation';
import { gradeGist } from '@/lib/ai/gradeGist';
import { shouldGenerateVocabDrills, generateVocabDrills } from '@/lib/ai/generateVocabDrills';
import { advanceSession } from '@/lib/session/advance';
import { computeStreak } from '@/lib/progress/streak';
import { GradeStatus, type GradingResult, type SessionStatus, type AttemptHistoryEntry } from '@/lib/data/types';

export type SubmitReviewInput = {
  sessionId: string;
  itemIndex: number;
  userInput: string;
};

export type SubmitReviewResult = {
  result: GradingResult;
  userInput: string; // Echo back for display in feedback UI
  nextIndex: number;
  status: SessionStatus;
  attemptHistory?: AttemptHistoryEntry[]; // Previous attempts on this sentence
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
export async function submitReviewForUser(params: SubmitReviewInput & {
  userId: string;
  token?: string;
  tzOffsetMin?: number;
  aiAllowed?: boolean;
}): Promise<SubmitReviewResult> {
  const { userId, itemIndex, userInput, token, tzOffsetMin, aiAllowed = true } = params;
  const sessionId = normalizeSessionId(params.sessionId);

  const data = createDataAdapter(token);
  const session = await data.getSession(sessionId, userId);

  if (!session) {
    throw new Error('Session not found');
  }

  const item = session.items[itemIndex];

  if (!item) {
    throw new Error('Invalid session item');
  }

  if (itemIndex !== session.currentIndex) {
    throw new Error('Out of sync');
  }

  // VOCAB_DRILL items are handled via /api/vocab-review, not this flow
  if (item.type === 'VOCAB_DRILL') {
    throw new Error('VOCAB_DRILL items should use /api/vocab-review endpoint');
  }

  // Grade based on item type and AI availability
  let result: GradingResult;
  let attemptHistory: Awaited<ReturnType<typeof data.getAttemptHistory>> | undefined;

  if (!aiAllowed) {
    // Rate limited or AI unavailable → fallback result
    const reference = item.type === 'REVIEW'
      ? item.sentence.referenceTranslation
      : item.reading.referenceGist;
    result = {
      status: GradeStatus.PARTIAL,
      feedback: 'The AI tutor is temporarily unavailable. Compare your answer with the reference and self-assess.',
      correction: reference,
    };
  } else if (item.type === 'REVIEW') {
    // Fetch attempt history for history-aware grading
    try {
      attemptHistory = await data.getAttemptHistory(userId, item.sentence.id, 5);
    } catch (e) {
      console.error('Failed to fetch attempt history (continuing):', e);
    }

    result = await gradeTranslation({
      latin: item.sentence.latin,
      userTranslation: userInput,
      reference: item.sentence.referenceTranslation,
      context: item.sentence.context,
      attemptHistory,
    });
  } else {
    // NEW_READING → use gist grader
    result = await gradeGist({
      latin: item.reading.latinText.join(' '),
      question: item.reading.gistQuestion,
      userAnswer: userInput,
      referenceGist: item.reading.referenceGist,
    });
  }

  // Record attempt (best-effort, don't block session)
  try {
    await data.recordAttempt({
      userId,
      sessionId: session.id,
      itemId: item.type === 'REVIEW' ? item.sentence.id : item.reading.id,
      type: item.type,
      userInput,
      gradingResult: result,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to record attempt (continuing):', e);
  }

  // Update FSRS spaced repetition state for review items (best-effort)
  if (item.type === 'REVIEW') {
    try {
      await data.recordReview(userId, item.sentence.id, result);
    } catch (e) {
      console.error('Failed to record review for FSRS (continuing):', e);
    }

    // Generate vocab drills for persistent struggling (best-effort)
    if (token && shouldGenerateVocabDrills(result, attemptHistory)) {
      try {
        const drills = await generateVocabDrills({
          latin: item.sentence.latin,
          sentenceId: item.sentence.id,
          gradingResult: result,
          attemptHistory,
        });

        // Save all drills to Convex in parallel
        await Promise.all(
          drills.map(drill =>
            fetchMutation(
              api.vocab.create,
              {
                userId,
                latinWord: drill.latinWord,
                meaning: drill.meaning,
                questionType: drill.questionType,
                question: drill.question,
                answer: drill.answer,
                sourceSentenceId: drill.sourceSentenceId,
              },
              { token }
            )
          )
        );

        if (drills.length > 0) {
          console.log(`[Vocab] Generated ${drills.length} vocab drills for user ${userId.slice(0, 8)}...`);
        }
      } catch (e) {
        console.error('Failed to generate/save vocab drills (continuing):', e);
      }
    }
  }

  const advanced = advanceSession(session);

  const updated = await data.advanceSession({
    sessionId: session.id,
    userId,
    nextIndex: advanced.nextIndex,
    status: advanced.status,
  });

  // Update user progress on session completion (best-effort)
  if (updated.status === 'complete' && tzOffsetMin === undefined) {
    console.warn('Session complete but tzOffsetMin missing; skipping streak/XP update');
  }
  if (updated.status === 'complete' && tzOffsetMin !== undefined) {
    try {
      const progress = await data.getUserProgress(userId);
      const nowMs = Date.now();
      const streakResult = computeStreak({
        prevStreak: progress?.streak ?? 0,
        prevLastSessionAtMs: progress?.lastSessionAt ?? 0,
        nowMs,
        tzOffsetMin,
      });

      await data.upsertUserProgress({
        userId,
        streak: streakResult.nextStreak,
        totalXp: (progress?.totalXp ?? 0) + session.items.length,
        maxDifficulty: progress?.maxDifficulty ?? 1,
        lastSessionAt: streakResult.nextLastSessionAtMs,
      });
    } catch (e) {
      console.error('Failed to update user progress (continuing):', e);
    }
  }

  return {
    result,
    userInput,
    nextIndex: updated.currentIndex,
    status: updated.status,
    attemptHistory,
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
  const { userId, token } = params;
  const sessionId = normalizeSessionId(params.sessionId);

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
