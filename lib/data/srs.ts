/**
 * Pure SRS (Spaced Repetition System) bucket algorithm.
 *
 * Simple bucket-based intervals: 1, 3, 7, 14, 30 days.
 * - CORRECT: advance bucket (harder = longer interval)
 * - PARTIAL: stay in bucket (review at same interval)
 * - INCORRECT: regress bucket (easier = shorter interval)
 *
 * This is intentionally simple. FSRS upgrade planned for Phase 3.
 */

import { GradeStatus } from '@/types';

/** Interval in days for each bucket level */
export const BUCKET_INTERVALS: readonly number[] = [1, 3, 7, 14, 30];

/** Maximum bucket index (0-indexed) */
export const MAX_BUCKET = BUCKET_INTERVALS.length - 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Result of SRS calculation - all fields needed to update review record */
export interface SRSUpdate {
  bucket: number;
  nextReviewAt: number; // Unix ms
  timesCorrect: number;
  timesIncorrect: number;
}

/**
 * Calculate next review state based on grading result.
 *
 * @param currentBucket - Current bucket level (0-4)
 * @param timesCorrect - Current correct count
 * @param timesIncorrect - Current incorrect count
 * @param gradeStatus - Result of grading (CORRECT, PARTIAL, INCORRECT)
 * @param nowMs - Current timestamp in Unix ms (defaults to Date.now())
 * @returns Updated SRS state
 */
export function calculateNextReview(
  currentBucket: number,
  timesCorrect: number,
  timesIncorrect: number,
  gradeStatus: GradeStatus,
  nowMs: number = Date.now()
): SRSUpdate {
  // Calculate new bucket based on grade
  let newBucket: number;
  if (gradeStatus === GradeStatus.CORRECT) {
    newBucket = Math.min(currentBucket + 1, MAX_BUCKET);
  } else if (gradeStatus === GradeStatus.INCORRECT) {
    newBucket = Math.max(currentBucket - 1, 0);
  } else {
    // PARTIAL - stay in current bucket
    newBucket = currentBucket;
  }

  // Calculate next review time based on new bucket
  const intervalDays = BUCKET_INTERVALS[newBucket];
  const nextReviewAt = nowMs + intervalDays * DAY_MS;

  // Update counters
  const newTimesCorrect = gradeStatus === GradeStatus.CORRECT ? timesCorrect + 1 : timesCorrect;
  const newTimesIncorrect = gradeStatus === GradeStatus.INCORRECT ? timesIncorrect + 1 : timesIncorrect;

  return {
    bucket: newBucket,
    nextReviewAt,
    timesCorrect: newTimesCorrect,
    timesIncorrect: newTimesIncorrect,
  };
}

/**
 * Check if a review is due.
 *
 * @param nextReviewAt - Scheduled review time in Unix ms
 * @param nowMs - Current timestamp in Unix ms (defaults to Date.now())
 * @returns true if review is due (nextReviewAt <= now)
 */
export function isDue(nextReviewAt: number, nowMs: number = Date.now()): boolean {
  return nextReviewAt <= nowMs;
}
