import { fetchQuery, fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { DAILY_READING, REVIEW_SENTENCES } from '@/constants';
import {
  Attempt,
  ContentSeed,
  DataAdapter,
  GradingResult,
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

const FALLBACK_CONTENT: ContentSeed = {
  review: REVIEW_SENTENCES,
  reading: DAILY_READING,
};

// State enum ↔ string helpers for Convex persistence
type StateString = 'new' | 'learning' | 'review' | 'relearning';

function stateToString(state: State): StateString {
  switch (state) {
    case State.New: return 'new';
    case State.Learning: return 'learning';
    case State.Review: return 'review';
    case State.Relearning: return 'relearning';
  }
}

function parseState(s: StateString): State {
  switch (s) {
    case 'new': return State.New;
    case 'learning': return State.Learning;
    case 'review': return State.Review;
    case 'relearning': return State.Relearning;
  }
}

// Reconstruct ts-fsrs Card from database fields
function reconstructCard(doc: {
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
}): Card {
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

function mapSentence(doc: {
  sentenceId: string;
  latin: string;
  referenceTranslation: string;
  difficulty?: number;
}): Sentence {
  return {
    id: doc.sentenceId,
    latin: doc.latin,
    referenceTranslation: doc.referenceTranslation,
    context: `Difficulty: ${doc.difficulty ?? 'unknown'}`,
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

  async getContent(): Promise<ContentSeed> {
    try {
      const sentences = await fetchQuery(api.sentences.getAll, {}, this.options);
      if (!sentences || sentences.length === 0) {
        return FALLBACK_CONTENT;
      }

      const mapped = sentences.map(mapSentence);
      return {
        review: mapped.slice(0, 3),
        reading: DAILY_READING,
      };
    } catch {
      return FALLBACK_CONTENT;
    }
  }

  async createSession(userId: string, items: SessionItem[]): Promise<Session> {
    const now = new Date().toISOString();
    const id = `sess_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const content = await this.getContent();
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
