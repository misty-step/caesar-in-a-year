/**
 * FSRS (Free Spaced Repetition Scheduler) wrapper.
 *
 * Thin layer over ts-fsrs exposing only what we need:
 * - Rating mapping from GradeStatus
 * - Scheduling function that handles new cards
 *
 * We use 3 ratings only: Again (forgot), Hard (struggled), Good (recalled).
 * Never Easy — quiz-based grading has no "effortless recall" signal.
 */

import { fsrs, createEmptyCard, Rating, State, type Card, type RecordLogItem } from 'ts-fsrs';
import { GradeStatus } from '@/types';

// Re-export for consumers
export { Rating, State, createEmptyCard };
export type { Card };

// 90% retention target — FSRS default, tune after collecting user data
const RETENTION_TARGET = 0.9;
const scheduler = fsrs({ request_retention: RETENTION_TARGET });

/**
 * Convert GradeStatus to FSRS Rating.
 *
 * INCORRECT → Again (forgot, relearn)
 * PARTIAL   → Hard  (struggled, slow advance)
 * CORRECT   → Good  (recalled, normal advance)
 */
export function mapGradeToRating(status: GradeStatus): Rating {
  switch (status) {
    case GradeStatus.INCORRECT:
      return Rating.Again;
    case GradeStatus.PARTIAL:
      return Rating.Hard;
    case GradeStatus.CORRECT:
      return Rating.Good;
  }
}

/**
 * Schedule next review based on current card state and grading result.
 *
 * @param card - Current card state (null for first review → creates new card)
 * @param status - Grading outcome
 * @param now - Review timestamp (defaults to new Date())
 * @returns Updated card with new due date, stability, difficulty, etc.
 */
export function scheduleReview(
  card: Card | null,
  status: GradeStatus,
  now: Date = new Date()
): Card {
  const currentCard: Card = card ?? createEmptyCard(now);
  const rating = mapGradeToRating(status);
  const schedulingCards = scheduler.repeat(currentCard, now);
  // ts-fsrs types IPreview doesn't include numeric index signature, but runtime keys are 1-4
  const result = (schedulingCards as unknown as Record<number, RecordLogItem>)[rating];
  return result.card;
}
