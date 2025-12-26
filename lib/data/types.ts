export enum GradeStatus {
  CORRECT = 'CORRECT',
  PARTIAL = 'PARTIAL',
  INCORRECT = 'INCORRECT'
}

export type ErrorType = 'grammar' | 'vocabulary' | 'word_order' | 'omission' | 'other';

export interface GradingError {
  type: ErrorType;
  latinSegment?: string;
  explanation: string;
}

export interface GlossaryEntry {
  word: string;
  meaning: string;
}

export interface GradingAnalysis {
  userTranslationLiteral?: string;
  errors: GradingError[];
  glossary?: GlossaryEntry[]; // word-meaning pairs for interactive display
}

export interface GradingResult {
  status: GradeStatus;
  feedback: string;
  correction?: string;
  analysis?: GradingAnalysis;
}

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
  streak: number;
  totalXp: number;
  maxDifficulty: number;
  lastSessionAt: number;
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

export interface ReviewSentence extends Sentence {
  reviewCount: number;
}

export interface ReviewStats {
  dueCount: number;
  totalReviewed: number;
  masteredCount: number;
}

export interface DataAdapter {
  getUserProgress(userId: string): Promise<UserProgress | null>;
  upsertUserProgress(progress: UserProgress): Promise<void>;
  getContent(userId: string): Promise<ContentSeed>;
  createSession(userId: string, items: SessionItem[]): Promise<Session>;
  getSession(sessionId: string, userId: string): Promise<Session | null>;
  advanceSession(params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: SessionStatus;
  }): Promise<Session>;
  recordAttempt(attempt: Attempt): Promise<void>;
  getDueReviews(userId: string, limit?: number): Promise<ReviewSentence[]>;
  getReviewStats(userId: string): Promise<ReviewStats>;
  recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void>;
  getMasteredAtLevel(userId: string, maxDifficulty: number): Promise<number>;
  incrementDifficulty(userId: string, increment?: number): Promise<{ maxDifficulty: number }>;
}
