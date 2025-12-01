import { DAILY_READING, REVIEW_SENTENCES } from '@/constants';
import type {
  Attempt,
  ContentSeed,
  DataAdapter,
  Session,
  SessionStatus,
  UserProgress,
} from './types';
import { buildSessionItems } from '@/lib/session/builder';
import { advanceSession } from '@/lib/session/advance';

// Exported type to avoid circular imports
export type { DataAdapter } from './types';

// Factory to select adapter; currently Convex primary.
export function createDataAdapter(): DataAdapter {
  return memoryAdapter;
}

const memoryContent: ContentSeed = {
  review: REVIEW_SENTENCES,
  reading: DAILY_READING,
};

// In-memory stores for local development. This keeps the API surface compatible
// with a future Convex/Neon implementation while allowing the app to function.
const progressStore = new Map<string, UserProgress>();
const sessionStore = new Map<string, Session>();
const attemptStore = new Map<string, Attempt[]>();

const memoryAdapter: DataAdapter = {
  async getUserProgress(userId: string): Promise<UserProgress | null> {
    const existing = progressStore.get(userId);
    if (existing) return existing;

    // Default starter progress; persisted in-memory once updated.
    return {
      userId,
      day: 1,
      streak: 0,
      totalXp: 0,
      unlockedPhase: 1,
    };
  },

  async upsertUserProgress(progress: UserProgress): Promise<void> {
    progressStore.set(progress.userId, progress);
  },

  async getContent(): Promise<ContentSeed> {
    return memoryContent;
  },

  async createSession(userId: string, items: Session['items']): Promise<Session> {
    const now = new Date().toISOString();
    const id = `sess_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const seededItems = items.length ? items : buildSessionItems(memoryContent);

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
  },

  async getSession(sessionId: string, userId: string): Promise<Session | null> {
    const session = sessionStore.get(sessionId);
    if (!session || session.userId !== userId) return null;
    return session;
  },

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

    // Trust the caller for pointer/status; still ensure we never regress index.
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
  },

  async recordAttempt(attempt: Attempt): Promise<void> {
    const existing = attemptStore.get(attempt.sessionId) ?? [];
    existing.push(attempt);
    attemptStore.set(attempt.sessionId, existing);
  },
};
