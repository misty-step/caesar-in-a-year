export enum SegmentType {
  REVIEW = 'REVIEW',
  NEW_READING = 'NEW_READING'
}

export enum GradeStatus {
  CORRECT = 'CORRECT',
  PARTIAL = 'PARTIAL',
  INCORRECT = 'INCORRECT'
}

export interface GradingResult {
  status: GradeStatus;
  feedback: string;
  correction?: string;
}

export interface Sentence {
  id: string;
  latin: string;
  referenceTranslation: string;
  context?: string; // e.g. "Who is performing the action?"
}

export interface ReadingPassage {
  id: string;
  title: string;
  latinText: string[]; // Array of sentences
  glossary: Record<string, string>; // Word -> Definition
  gistQuestion: string;
  referenceGist: string;
}

export interface SessionItem {
  type: SegmentType;
  // If review
  sentence?: Sentence;
  // If new reading
  reading?: ReadingPassage;
}

export interface UserProgress {
  currentDay: number;
  totalXp: number;
  streak: number;
  unlockedPhase: number;
}