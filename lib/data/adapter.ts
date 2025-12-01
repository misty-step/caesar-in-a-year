import { DAILY_READING, REVIEW_SENTENCES } from '@/constants';
import type { Attempt, ContentSeed, DataAdapter, Session, SessionStatus, UserProgress } from './types';

// Exported type to avoid circular imports
export type { DataAdapter } from './types';

// Factory to select adapter; currently Convex primary.
export function createDataAdapter(): DataAdapter {
  return convexAdapter;
}

const memoryContent: ContentSeed = {
  review: REVIEW_SENTENCES,
  reading: DAILY_READING,
};

const notImplemented = (method: string) => {
  throw new Error(`${method} is not yet implemented for Convex adapter.`);
};

const convexAdapter: DataAdapter = {
  async getUserProgress(userId: string): Promise<UserProgress | null> {
    // Placeholder: return starter progress
    return {
      userId,
      day: 1,
      streak: 0,
      totalXp: 0,
      unlockedPhase: 1,
    };
  },

  async upsertUserProgress(_progress: UserProgress): Promise<void> {
    notImplemented('upsertUserProgress');
  },

  async getContent(): Promise<ContentSeed> {
    return memoryContent;
  },

  async createSession(_userId: string, _items: Session['items']): Promise<Session> {
    notImplemented('createSession');
    return {} as Session;
  },

  async getSession(_sessionId: string, _userId: string): Promise<Session | null> {
    notImplemented('getSession');
    return null;
  },

  async advanceSession(_params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: SessionStatus;
  }): Promise<Session> {
    notImplemented('advanceSession');
    return {} as Session;
  },

  async recordAttempt(_attempt: Attempt): Promise<void> {
    notImplemented('recordAttempt');
  },
};
