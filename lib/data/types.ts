export enum GradeStatus {
  CORRECT = 'CORRECT',
  PARTIAL = 'PARTIAL',
  INCORRECT = 'INCORRECT'
}

export type ErrorType = 'grammar' | 'vocabulary' | 'word_order' | 'omission' | 'comprehension' | 'misreading' | 'other';

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

export interface RateLimitInfo {
  remaining: number;
  resetAtMs: number;
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
  sentenceIds: string[]; // Individual sentence IDs for progress tracking
  glossary: Record<string, string>;
  gistQuestion: string;
  referenceGist: string;
}

/** Vocabulary card for adaptive learning */
export interface VocabCard {
  id: string;
  latinWord: string;
  meaning: string;
  questionType: 'latin_to_english'; // Meaning-focused only; grammar emerges from AI feedback
  question: string;
  answer: string;
  sourceSentenceId: string;
}

/** Phrase card for chunk translation (2-4 words) */
export interface PhraseCard {
  id: string;
  latin: string;           // 2-4 word chunk, e.g., "in fines eorum"
  english: string;         // "into their territory"
  sourceSentenceId: string;
  context?: string;        // Optional surrounding sentence
}

export type SessionItem =
  | { type: 'REVIEW'; sentence: Sentence }
  | { type: 'NEW_READING'; reading: ReadingPassage }
  | { type: 'VOCAB_DRILL'; vocab: VocabCard }
  | { type: 'PHRASE_DRILL'; phrase: PhraseCard };

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
  userId: string;
  sessionId: string;
  itemId: string; // sentenceId or readingId
  type: SessionItem['type'];
  userInput: string;
  gradingResult: GradingResult;
  createdAt: string;
}

/** Persisted attempt history entry (returned from queries) */
export interface AttemptHistoryEntry {
  sentenceId: string;
  userInput: string;
  gradingStatus: string;
  errorTypes: string[];
  createdAt: number;
}

export interface ContentSeed {
  review: Sentence[];
  reading: ReadingPassage;
  vocab: VocabCard[];
  phrases: PhraseCard[];
}

export interface ReviewSentence extends Sentence {
  reviewCount: number;
}

export interface ReviewStats {
  dueCount: number;
  totalReviewed: number;
  masteredCount: number;
}

// === Progress Visualization Types ===

/** Roman military ranks based on FSRS stability */
export interface LegionTiers {
  tirones: number;    // stability < 1 day (recruits)
  milites: number;    // stability 1-7 days (soldiers)
  veterani: number;   // stability 7-21 days (veterans)
  decuriones: number; // stability 21+ days (officers/masters)
}

/** Journey through Caesar's text */
export interface JourneyProgress {
  sentencesEncountered: number;
  totalSentences: number;
  percentComplete: number;
  contentDay: number;    // 1-indexed, sentences as "days" of content
  daysActive: number;    // Calendar days since first session
  scheduleDelta: number; // positive = ahead, negative = behind, 0 = on track
}

/** XP and level data */
export interface XPProgress {
  total: number;
  level: number;
  currentLevelXp: number;
  toNextLevel: number;
}

/** Daily activity for heatmap */
export interface ActivityDay {
  date: string; // YYYY-MM-DD
  count: number;
}

/**
 * Deep module: All progress metrics in one response.
 * UI components just render slices, no calculation.
 */
export interface ProgressMetrics {
  legion: LegionTiers;
  iter: JourneyProgress;
  activity: ActivityDay[];
  xp: XPProgress;
  streak: number;
}

export interface DataAdapter {
  getUserProgress(userId: string): Promise<UserProgress | null>;
  upsertUserProgress(progress: UserProgress): Promise<void>;
  getContent(userId: string, daysActive?: number): Promise<ContentSeed>;
  createSession(userId: string, items: SessionItem[]): Promise<Session>;
  getSession(sessionId: string, userId: string): Promise<Session | null>;
  advanceSession(params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: SessionStatus;
  }): Promise<Session>;
  recordAttempt(attempt: Attempt): Promise<void>;
  getAttemptHistory(userId: string, sentenceId: string, limit?: number): Promise<AttemptHistoryEntry[]>;
  getDueReviews(userId: string, limit?: number): Promise<ReviewSentence[]>;
  getReviewStats(userId: string): Promise<ReviewStats>;
  recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void>;
  getMasteredAtLevel(userId: string, maxDifficulty: number): Promise<number>;
  incrementDifficulty(userId: string, increment?: number): Promise<{ maxDifficulty: number }>;
  getProgressMetrics(userId: string, tzOffsetMin?: number): Promise<ProgressMetrics>;
}
