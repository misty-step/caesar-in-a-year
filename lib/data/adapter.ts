import { DAILY_READING, REVIEW_SENTENCES } from '@/constants';
import type {
  Attempt,
  ContentSeed,
  DataAdapter,
  Sentence,
  Session,
  SessionStatus,
  UserProgress,
  ReviewSentence,
  ReviewStats,
} from './types';
import { buildSessionItems } from '@/lib/session/builder';
import { generateSessionId } from '@/lib/session/id';
import { promises as fs } from 'fs';
import path from 'path';
import { ConvexAdapter } from './convexAdapter';

// Exported type to avoid circular imports
export type { DataAdapter } from './types';

/**
 * Factory to create the appropriate DataAdapter.
 *
 * @param token - Auth token for Convex (from Clerk). If provided, uses ConvexAdapter.
 *                If not provided, falls back to in-memory adapter (dev only).
 */
export function createDataAdapter(token?: string): DataAdapter {
  // In production, always require Convex token
  if (!token && process.env.NODE_ENV === 'production') {
    throw new Error('[DataAdapter] Convex token required in production');
  }

  if (token) {
    console.log('[DataAdapter] Using ConvexAdapter');
    return new ConvexAdapter(token);
  }

  console.warn('[DataAdapter] No token provided, falling back to memoryAdapter');
  return memoryAdapter;
}

// Static fallback content
const staticContent: ContentSeed = {
  review: REVIEW_SENTENCES,
  reading: DAILY_READING,
};

// Corpus file path (relative to project root)
const CORPUS_PATH = path.join(process.cwd(), 'content', 'corpus.json');

/**
 * Load sentences from corpus.json if available.
 * Falls back to static content on error.
 */
async function loadCorpusSentences(): Promise<Sentence[]> {
  try {
    const raw = await fs.readFile(CORPUS_PATH, 'utf-8');
    const data = JSON.parse(raw);

    if (!data.sentences || !Array.isArray(data.sentences)) {
      return [];
    }

    // Transform corpus format to Sentence type
    return data.sentences.map(
      (s: {
        id: string;
        latin: string;
        referenceTranslation: string;
        difficulty?: number;
      }) => ({
        id: s.id,
        latin: s.latin,
        referenceTranslation: s.referenceTranslation,
        context: `Difficulty: ${s.difficulty ?? 'unknown'}`,
      })
    );
  } catch {
    // File not found or parse error - fall back to static
    return [];
  }
}

// Cached content (loaded once per process)
let cachedContent: ContentSeed | null = null;

async function getMemoryContent(): Promise<ContentSeed> {
  if (cachedContent) return cachedContent;

  const corpusSentences = await loadCorpusSentences();

  if (corpusSentences.length > 0) {
    // Use corpus sentences for review, keep static reading passage
    cachedContent = {
      review: corpusSentences.slice(0, 3), // First 3 sentences for review
      reading: DAILY_READING,
    };
  } else {
    cachedContent = staticContent;
  }

  return cachedContent;
}

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
      streak: 0,
      totalXp: 0,
      maxDifficulty: 1,
      lastSessionAt: 0,
    };
  },

  async upsertUserProgress(progress: UserProgress): Promise<void> {
    progressStore.set(progress.userId, progress);
  },

  async getContent(_userId: string): Promise<ContentSeed> {
    return getMemoryContent();
  },

  async createSession(userId: string, items: Session['items']): Promise<Session> {
    const now = new Date().toISOString();
    const id = generateSessionId();

    const content = await getMemoryContent();
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

  async getDueReviews(): Promise<ReviewSentence[]> {
    return [];
  },

  async getReviewStats(): Promise<ReviewStats> {
    return { dueCount: 0, totalReviewed: 0, masteredCount: 0 };
  },

  async recordReview(): Promise<void> {
    return;
  },
};
