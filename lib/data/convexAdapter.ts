import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { DAILY_READING, REVIEW_SENTENCES } from '@/constants';
import {
  Attempt,
  AttemptHistoryEntry,
  ContentSeed,
  DataAdapter,
  GradingResult,
  PhraseCard,
  ProgressMetrics,
  ReadingPassage,
  ReviewSentence,
  ReviewStats,
  Sentence,
  Session,
  SessionItem,
  SessionStatus,
  UserProgress,
  VocabCard,
} from './types';
import { buildSessionItems } from '@/lib/session/builder';
import { generateSessionId } from '@/lib/session/id';
import { scheduleReview, State, type Card } from '@/lib/srs/fsrs';

const DEFAULT_MAX_DIFFICULTY = 10;

const FALLBACK_CONTENT: ContentSeed = {
  review: REVIEW_SENTENCES,
  reading: DAILY_READING,
  vocab: [],
  phrases: [],
};

// State enum ↔ string helpers for Convex persistence
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

// FSRS review document type from database
type FsrsReviewDoc = {
  state: StateString;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview?: number;
  nextReviewAt: number;
};

// Reconstruct ts-fsrs Card from database fields
function reconstructCard(doc: FsrsReviewDoc): Card {
  return {
    state: parseState(doc.state),
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

type SentenceDoc = {
  sentenceId: string;
  latin: string;
  referenceTranslation: string;
  difficulty?: number;
};

function mapSentence(doc: SentenceDoc): Sentence {
  return {
    id: doc.sentenceId,
    latin: doc.latin,
    referenceTranslation: doc.referenceTranslation,
    context: `Difficulty: ${doc.difficulty ?? 'unknown'}`,
  };
}

function mapToReading(sentences: SentenceDoc[]): ReadingPassage {
  const first = sentences[0];
  const parts = first.sentenceId.split('.');
  return {
    id: `reading-${first.sentenceId}`,
    title: `De Bello Gallico ${parts.slice(1, 3).join('.')}`,
    latinText: sentences.map((s) => s.latin),
    sentenceIds: sentences.map((s) => s.sentenceId),
    glossary: {},
    gistQuestion: 'Translate this passage into natural English.',
    referenceGist: sentences.map((s) => s.referenceTranslation).join(' '),
  };
}

const DEFAULT_PROGRESS: Omit<UserProgress, 'userId'> = {
  streak: 0,
  totalXp: 0,
  maxDifficulty: 1,
  lastSessionAt: 0,
};

// Structured logger for observability
const logger = {
  query: (name: string, args: Record<string, unknown>) => {
    console.log(`[Convex:Query] ${name}`, JSON.stringify(args));
  },
  mutation: (name: string, args: Record<string, unknown>) => {
    console.log(`[Convex:Mutation] ${name}`, JSON.stringify(args));
  },
  error: (op: string, error: unknown) => {
    console.error(`[Convex:Error] ${op}`, error);
  },
  warn: (op: string, message: string) => {
    console.warn(`[Convex:Warn] ${op}`, message);
  },
};

/**
 * Convex-backed DataAdapter for server-side persistence.
 *
 * Uses fetchQuery/fetchMutation from convex/nextjs for imperative calls.
 * Sessions are persisted in Convex to survive across server processes.
 *
 * Requires auth token for authenticated Convex functions.
 */
export class ConvexAdapter implements DataAdapter {
  constructor(private token?: string) {}

  private get options() {
    return this.token ? { token: this.token } : undefined;
  }

  async getUserProgress(userId: string): Promise<UserProgress | null> {
    const progress = await fetchQuery(api.userProgress.get, { userId }, this.options);
    if (!progress) {
      return { userId, ...DEFAULT_PROGRESS };
    }
    return {
      userId: progress.userId,
      streak: progress.streak,
      totalXp: progress.totalXp,
      maxDifficulty: progress.maxDifficulty,
      lastSessionAt: progress.lastSessionAt,
    };
  }

  async upsertUserProgress(progress: UserProgress): Promise<void> {
    await fetchMutation(api.userProgress.upsert, progress, this.options);
  }

  async getContent(userId: string, daysActive?: number): Promise<ContentSeed> {
    // Import config to determine fetch limits based on user progress
    const { getSessionConfig } = await import('@/lib/session/config');
    const config = getSessionConfig(daysActive ?? 1);

    try {
      // 1. Get user progress (or default)
      const progress = await this.getUserProgress(userId);
      const maxDifficulty = progress?.maxDifficulty ?? DEFAULT_MAX_DIFFICULTY;

      // 2. Get due reviews (FSRS-scheduled) - fetch more than needed for flexibility
      const dueReviews = await this.getDueReviews(userId, config.reviewCount + 2);

      // 3. Get due vocab and phrase cards (FSRS-scheduled)
      const dueVocab = await this.getDueVocab(userId, config.vocabCount);
      const duePhrases = await this.getDuePhrases(userId, config.phraseCount);

      // 4. Get candidate sentences at/below difficulty
      const candidates = await fetchQuery(
        api.sentences.getByDifficulty,
        { maxDifficulty },
        this.options
      );

      if (!candidates || candidates.length === 0) {
        return {
          review: dueReviews.length > 0 ? dueReviews : FALLBACK_CONTENT.review,
          reading: FALLBACK_CONTENT.reading,
          vocab: dueVocab,
          phrases: duePhrases,
        };
      }

      // 5. Get seen sentence IDs
      const seenIds = new Set(
        await fetchQuery(api.reviews.getSentenceIds, { userId }, this.options)
      );

      // 6. Filter unseen, sort by difficulty (easiest first), take config amount
      const unseen = candidates
        .filter((s) => !seenIds.has(s.sentenceId))
        .sort((a, b) => a.difficulty - b.difficulty)
        .slice(0, config.newSentenceCount);

      // 7. Build response
      const reviewContent = dueReviews.length > 0 ? dueReviews : candidates.slice(0, 3).map(mapSentence);

      if (unseen.length > 0) {
        return {
          review: reviewContent,
          reading: mapToReading(unseen),
          vocab: dueVocab,
          phrases: duePhrases,
        };
      }

      // User has seen everything at their level
      return {
        review: reviewContent,
        reading: FALLBACK_CONTENT.reading,
        vocab: dueVocab,
        phrases: duePhrases,
      };
    } catch {
      return FALLBACK_CONTENT;
    }
  }

  async getDueVocab(userId: string, limit?: number): Promise<VocabCard[]> {
    const results = await fetchQuery(api.vocab.getDue, { userId, limit }, this.options);
    return results as VocabCard[];
  }

  async getDuePhrases(userId: string, limit?: number): Promise<PhraseCard[]> {
    const results = await fetchQuery(api.phrases.getDue, { userId, limit }, this.options);
    return results as PhraseCard[];
  }

  async createSession(userId: string, items: SessionItem[]): Promise<Session> {
    const now = new Date().toISOString();
    const sessionId = generateSessionId();

    // Get daysActive from progress metrics for dynamic session composition
    const metrics = await this.getProgressMetrics(userId);
    const daysActive = metrics.iter.daysActive;

    const content = await this.getContent(userId, daysActive);
    const seededItems = items.length ? items : buildSessionItems(content, daysActive);

    logger.mutation('sessions.create', { sessionId, userId: userId.slice(0, 8) + '...', itemCount: seededItems.length });

    await fetchMutation(
      api.sessions.create,
      {
        sessionId,
        userId,
        items: seededItems,
        currentIndex: 0,
        status: 'active' as const,
        startedAt: now,
      },
      this.options
    );

    console.log(`[Session:Created] ${sessionId}`);

    return {
      id: sessionId,
      userId,
      items: seededItems,
      currentIndex: 0,
      status: 'active',
      startedAt: now,
    };
  }

  async getSession(sessionId: string, userId: string): Promise<Session | null> {
    logger.query('sessions.get', { sessionId, userId: userId.slice(0, 8) + '...' });

    const result = await fetchQuery(
      api.sessions.get,
      { sessionId, userId },
      this.options
    );

    // Handle error responses from Convex
    if (result.error) {
      logger.error('sessions.get', `${result.error} for session ${sessionId}`);
      if (result.error === 'AUTH_REQUIRED') {
        throw new Error('Authentication required for session access');
      }
      return null;
    }

    if (!result.session) {
      logger.warn('sessions.get', `No session returned for ${sessionId}`);
      return null;
    }

    return {
      id: result.session.sessionId,
      userId: result.session.userId,
      items: result.session.items as SessionItem[],
      currentIndex: result.session.currentIndex,
      status: result.session.status,
      startedAt: result.session.startedAt,
      completedAt: result.session.completedAt,
    };
  }

  async advanceSession(params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: SessionStatus;
  }): Promise<Session> {
    const session = await this.getSession(params.sessionId, params.userId);
    if (!session) {
      throw new Error('Session not found');
    }

    const nextIndex = Math.max(session.currentIndex, params.nextIndex);
    const completedAt =
      params.status === 'complete'
        ? session.completedAt ?? new Date().toISOString()
        : undefined;

    await fetchMutation(
      api.sessions.advance,
      {
        sessionId: params.sessionId,
        userId: params.userId,
        currentIndex: nextIndex,
        status: params.status,
        completedAt,
      },
      this.options
    );

    return {
      ...session,
      currentIndex: nextIndex,
      status: params.status,
      completedAt,
    };
  }

  async recordAttempt(attempt: Attempt): Promise<void> {
    // Extract error types from grading result
    const errorTypes = attempt.gradingResult.analysis?.errors.map(e => e.type) ?? [];

    await fetchMutation(
      api.attempts.record,
      {
        userId: attempt.userId,
        sentenceId: attempt.itemId,
        sessionId: attempt.sessionId,
        userInput: attempt.userInput,
        gradingStatus: attempt.gradingResult.status,
        errorTypes,
      },
      this.options
    );
  }

  async getAttemptHistory(userId: string, sentenceId: string, limit?: number): Promise<AttemptHistoryEntry[]> {
    const results = await fetchQuery(
      api.attempts.getHistory,
      { userId, sentenceId, limit },
      this.options
    );

    return results.map(r => ({
      sentenceId: r.sentenceId,
      userInput: r.userInput,
      gradingStatus: r.gradingStatus,
      errorTypes: r.errorTypes,
      createdAt: r.createdAt,
    }));
  }

  async getDueReviews(userId: string, limit?: number): Promise<ReviewSentence[]> {
    const results = await fetchQuery(api.reviews.getDue, { userId, limit }, this.options);
    return results as ReviewSentence[];
  }

  async getReviewStats(userId: string): Promise<ReviewStats> {
    return fetchQuery(api.reviews.getStats, { userId }, this.options) as Promise<ReviewStats>;
  }

  async recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void> {
    const now = new Date();
    const existing = await fetchQuery(api.reviews.getOne, { userId, sentenceId }, this.options);

    // Reconstruct card from database or pass null for new cards
    const currentCard: Card | null = existing ? reconstructCard(existing) : null;

    // Schedule using FSRS
    const newCard = scheduleReview(currentCard, result.status, now);

    await fetchMutation(api.reviews.record, {
      userId,
      sentenceId,
      state: stateToString(newCard.state),
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      elapsedDays: newCard.elapsed_days,
      scheduledDays: newCard.scheduled_days,
      learningSteps: newCard.learning_steps,
      reps: newCard.reps,
      lapses: newCard.lapses,
      lastReview: newCard.last_review?.getTime(),
      nextReviewAt: newCard.due.getTime(),
    }, this.options);
  }

  async getMasteredAtLevel(userId: string, maxDifficulty: number): Promise<number> {
    return fetchQuery(api.reviews.getMasteredAtLevel, { userId, maxDifficulty }, this.options);
  }

  async incrementDifficulty(userId: string, increment: number = 5): Promise<{ maxDifficulty: number }> {
    return fetchMutation(api.userProgress.incrementDifficulty, { userId, increment }, this.options);
  }

  async getProgressMetrics(userId: string, tzOffsetMin?: number): Promise<ProgressMetrics> {
    return fetchQuery(api.progress.getMetrics, { userId, tzOffsetMin }, this.options) as Promise<ProgressMetrics>;
  }
}
