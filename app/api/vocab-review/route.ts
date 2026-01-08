import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { advanceSession } from '@/lib/session/advance';
import { normalizeSessionId } from '@/lib/session/id';
import { scheduleReview, State, type Card } from '@/lib/srs/fsrs';
import { GradeStatus, type SessionItem, type VocabCard } from '@/lib/data/types';
import { gradeVocab } from '@/lib/ai/gradeVocab';

export const runtime = 'nodejs';

// State enum ↔ string helpers
type StateString = 'new' | 'learning' | 'review' | 'relearning';

const stateToStringMap: Record<State, StateString> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

function stateToString(state: State): StateString {
  return stateToStringMap[state];
}

const stringToStateMap: Record<StateString, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

function parseState(s: StateString): State {
  return stringToStateMap[s];
}

// Reconstruct ts-fsrs Card from database fields
function reconstructCard(doc: {
  state: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview?: number;
  nextReviewAt: number;
}): Card {
  return {
    state: parseState(doc.state as StateString),
    stability: doc.stability,
    difficulty: doc.difficulty,
    elapsed_days: doc.elapsedDays,
    scheduled_days: doc.scheduledDays,
    learning_steps: doc.learningSteps,
    reps: doc.reps,
    lapses: doc.lapses,
    last_review: doc.lastReview ? new Date(doc.lastReview) : undefined,
    due: new Date(doc.nextReviewAt),
  };
}

export async function POST(req: Request) {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);

    const sessionId = body?.sessionId;
    const itemIndex = body?.itemIndex;
    const vocabCardId = body?.vocabCardId;
    const userInput = body?.userInput;

    if (
      typeof sessionId !== 'string' ||
      typeof itemIndex !== 'number' ||
      typeof vocabCardId !== 'string' ||
      typeof userInput !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const normalizedSessionId = normalizeSessionId(sessionId);
    const token = await getToken({ template: 'convex' });
    const options = token ? { token } : undefined;

    // 1. Get session to validate
    const sessionResult = await fetchQuery(
      api.sessions.get,
      { sessionId: normalizedSessionId, userId },
      options
    );

    if (sessionResult.error || !sessionResult.session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessionResult.session;

    // 2. Validate item index
    if (itemIndex !== session.currentIndex) {
      return NextResponse.json({ error: 'Out of sync' }, { status: 400 });
    }

    const item = session.items[itemIndex] as SessionItem;
    if (!item || item.type !== 'VOCAB_DRILL') {
      return NextResponse.json({ error: 'Invalid session item' }, { status: 400 });
    }

    // 3. Get vocab card data for AI grading
    const vocabCard = await fetchQuery(
      api.vocab.get,
      { userId, cardId: vocabCardId as Id<'vocabCards'> },
      options
    );

    if (!vocabCard) {
      return NextResponse.json({ error: 'Vocab card not found' }, { status: 404 });
    }

    // 4. Call AI grader
    const vocab = item.vocab as VocabCard;
    const gradingResult = await gradeVocab({
      latinWord: vocab.latinWord,
      meaning: vocab.meaning,
      question: vocab.question,
      userAnswer: userInput,
    });

    // 5. Update FSRS state
    const now = new Date();
    const currentCard = reconstructCard(vocabCard);
    const newCard = scheduleReview(currentCard, gradingResult.status, now);

    await fetchMutation(
      api.vocab.recordReview,
      {
        userId,
        cardId: vocabCardId as Id<'vocabCards'>,
        gradingStatus: gradingResult.status,
        state: stateToString(newCard.state),
        stability: newCard.stability,
        difficulty: newCard.difficulty,
        elapsedDays: newCard.elapsed_days,
        scheduledDays: newCard.scheduled_days,
        learningSteps: newCard.learning_steps,
        reps: newCard.reps,
        lapses: newCard.lapses,
        nextReviewAt: newCard.due.getTime(),
      },
      options
    );

    // 6. Advance session
    const advanced = advanceSession({
      id: session.sessionId,
      userId: session.userId,
      items: session.items as SessionItem[],
      currentIndex: session.currentIndex,
      status: session.status,
      startedAt: session.startedAt,
    });

    await fetchMutation(
      api.sessions.advance,
      {
        sessionId: normalizedSessionId,
        userId,
        currentIndex: Math.max(session.currentIndex, advanced.nextIndex),
        status: advanced.status,
        completedAt: advanced.status === 'complete' ? new Date().toISOString() : undefined,
      },
      options
    );

    return NextResponse.json({
      nextIndex: advanced.nextIndex,
      status: advanced.status,
      grading: gradingResult,
    });
  } catch (error) {
    console.error('Error in POST /api/vocab-review', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
