import { GradeStatus, type GradingResult } from '@/types';

export interface Sentence {
  id: string;
  latin: string;
  referenceTranslation: string;
  context?: string;
}

export interface ReadingPassage {
  id: string;
  title: string;
  latinText: string[];
  glossary: Record<string, string>;
  gistQuestion: string;
  referenceGist: string;
}

export type SessionItem =
  | { type: 'REVIEW'; sentence: Sentence }
  | { type: 'NEW_READING'; reading: ReadingPassage };

export type SessionStatus = 'active' | 'complete';

export interface Session {
  id: string;
  userId: string;
  items: SessionItem[];
  currentIndex: number;
  status: SessionStatus;
  startedAt: string;
  completedAt?: string;
}

export interface UserProgress {
  userId: string;
  day: number;
  streak: number;
  totalXp: number;
  unlockedPhase: number;
}

export interface Attempt {
  sessionId: string;
  itemId: string;
  type: SessionItem['type'];
  userInput: string;
  gradingResult: GradingResult;
  createdAt: string;
}

export interface ContentSeed {
  review: Sentence[];
  reading: ReadingPassage;
}

export { GradeStatus, type GradingResult };

export interface DataAdapter {
  getUserProgress(userId: string): Promise<UserProgress | null>;
  upsertUserProgress(progress: UserProgress): Promise<void>;
  getContent(): Promise<ContentSeed>;
  createSession(userId: string, items: SessionItem[]): Promise<Session>;
  getSession(sessionId: string, userId: string): Promise<Session | null>;
  advanceSession(params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: SessionStatus;
  }): Promise<Session>;
  recordAttempt(attempt: Attempt): Promise<void>;
}
