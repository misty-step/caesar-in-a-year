import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { DAILY_READING, REVIEW_SENTENCES } from '@/constants';
import {
  Attempt,
  ContentSeed,
  DataAdapter,
  GradingResult,
  ReadingPassage,
  ReviewSentence,
  ReviewStats,
  Sentence,
  Session,
  SessionItem,
  SessionStatus,
  UserProgress,
} from './types';
import { buildSessionItems } from '@/lib/session/builder';
import { scheduleReview, State, type Card } from '@/lib/srs/fsrs';

const DEFAULT_MAX_DIFFICULTY = 10;

const FALLBACK_CONTENT: ContentSeed = {
  review: REVIEW_SENTENCES,
  reading: DAILY_READING,
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

// Module-scoped session store shared across all adapter instances
// Keeps sessions ephemeral but reusable across requests in same process
const sessionStore = new Map<string, Session>();

/**
 * Convex-backed DataAdapter for server-side persistence.
 *
 * Uses fetchQuery/fetchMutation from convex/nextjs for imperative calls.
 * Sessions remain ephemeral (in-memory) per DESIGN.md.
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

  async getContent(userId: string): Promise<ContentSeed> {
    try {
      // 1. Get user progress (or default)
      const progress = await this.getUserProgress(userId);
      const maxDifficulty = progress?.maxDifficulty ?? DEFAULT_MAX_DIFFICULTY;

      // 2. Get due reviews (FSRS-scheduled)
      const dueReviews = await this.getDueReviews(userId, 5);

      // 3. Get candidate sentences at/below difficulty
      const candidates = await fetchQuery(
        api.sentences.getByDifficulty,
        { maxDifficulty },
        this.options
      );

      if (!candidates || candidates.length === 0) {
        return {
          review: dueReviews.length > 0 ? dueReviews : FALLBACK_CONTENT.review,
          reading: FALLBACK_CONTENT.reading,
        };
      }

      // 4. Get seen sentence IDs
      const seenIds = new Set(
        await fetchQuery(api.reviews.getSentenceIds, { userId }, this.options)
      );

      // 5. Filter unseen, sort by difficulty (easiest first), take 2
      const unseen = candidates
        .filter((s) => !seenIds.has(s.sentenceId))
        .sort((a, b) => a.difficulty - b.difficulty)
        .slice(0, 2);

      // 6. Build response
      const reviewContent = dueReviews.length > 0 ? dueReviews : candidates.slice(0, 3).map(mapSentence);

      if (unseen.length > 0) {
        return {
          review: reviewContent,
          reading: mapToReading(unseen),
        };
      }

      // User has seen everything at their level
      return {
        review: reviewContent,
        reading: FALLBACK_CONTENT.reading,
      };
    } catch {
      return FALLBACK_CONTENT;
    }
  }

  async createSession(userId: string, items: SessionItem[]): Promise<Session> {
    const now = new Date().toISOString();
    const id = `sess_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const content = await this.getContent(userId);
    const seededItems = items.length ? items : buildSessionItems(content);

    const session: Session = {
      id,
      userId,
      items: seededItems,
      currentIndex: 0,
      status: 'active',
      startedAt: now,
    };

    sessionStore.set(id, session);
    return session;
  }

  async getSession(sessionId: string, userId: string): Promise<Session | null> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) return null;
    return session;
  }

  async advanceSession(params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: SessionStatus;
  }): Promise<Session> {
    const session = sessionStore.get(params.sessionId);
    if (!session || session.userId !== params.userId) {
      throw new Error('Session not found');
    }

    const nextIndex = Math.max(session.currentIndex, params.nextIndex);
    const base: Session = {
      ...session,
      currentIndex: nextIndex,
      status: params.status,
    };

    const finalized =
      params.status === 'complete'
        ? {
            ...base,
            completedAt: base.completedAt ?? new Date().toISOString(),
          }
        : base;

    sessionStore.set(finalized.id, finalized);
    return finalized;
  }

  // Phase 1: attempts not persisted
  async recordAttempt(_attempt: Attempt): Promise<void> {
    return;
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
}
