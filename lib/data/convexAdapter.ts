import { ConvexReactClient } from 'convex/react';
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
import { calculateNextReview } from './srs';

const FALLBACK_CONTENT: ContentSeed = {
  review: REVIEW_SENTENCES,
  reading: DAILY_READING,
};

function mapSentence(doc: any): Sentence {
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

export class ConvexAdapter implements DataAdapter {
  private sessionStore = new Map<string, Session>();

  constructor(private client: ConvexReactClient) {}

  async getUserProgress(userId: string): Promise<UserProgress | null> {
    const progress = await this.client.query('userProgress:get', { userId });
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
    await this.client.mutation('userProgress:upsert', progress);
  }

  async getContent(): Promise<ContentSeed> {
    try {
      const sentences = await this.client.query('sentences:getAll', {});
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

    this.sessionStore.set(id, session);
    return session;
  }

  async getSession(sessionId: string, userId: string): Promise<Session | null> {
    const session = this.sessionStore.get(sessionId);
    if (!session || session.userId !== userId) return null;
    return session;
  }

  async advanceSession(params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: SessionStatus;
  }): Promise<Session> {
    const session = this.sessionStore.get(params.sessionId);
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

    this.sessionStore.set(finalized.id, finalized);
    return finalized;
  }

  // Phase 1: attempts not persisted
  async recordAttempt(_attempt: Attempt): Promise<void> {
    return;
  }

  async getDueReviews(userId: string, limit?: number): Promise<ReviewSentence[]> {
    const results = await this.client.query('reviews:getDue', {
      userId,
      limit,
    });
    return results as ReviewSentence[];
  }

  async getReviewStats(userId: string): Promise<ReviewStats> {
    return this.client.query('reviews:getStats', { userId }) as Promise<ReviewStats>;
  }

  async recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void> {
    const now = Date.now();
    const existing = await this.client.query('reviews:getOne', { userId, sentenceId });

    const currentBucket = existing?.bucket ?? 0;
    const currentCorrect = existing?.timesCorrect ?? 0;
    const currentIncorrect = existing?.timesIncorrect ?? 0;

    const update = calculateNextReview(currentBucket, currentCorrect, currentIncorrect, result.status, now);

    await this.client.mutation('reviews:record', {
      userId,
      sentenceId,
      bucket: update.bucket,
      nextReviewAt: update.nextReviewAt,
      lastReviewedAt: now,
      timesCorrect: update.timesCorrect,
      timesIncorrect: update.timesIncorrect,
    });
  }
}
