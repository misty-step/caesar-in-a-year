import { describe, expect, it } from 'vitest';
import {
  BUCKET_INTERVALS,
  MAX_BUCKET,
  calculateNextReview,
  isDue,
} from '../srs';
import { GradeStatus } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('SRS constants', () => {
  it('has correct bucket intervals in days', () => {
    expect(BUCKET_INTERVALS).toEqual([1, 3, 7, 14, 30]);
  });

  it('has MAX_BUCKET at 4', () => {
    expect(MAX_BUCKET).toBe(4);
  });
});

describe('calculateNextReview', () => {
  const baseTime = 1700000000000; // Fixed timestamp for testing

  describe('bucket advancement', () => {
    it('advances bucket on CORRECT', () => {
      const result = calculateNextReview(1, 0, 0, GradeStatus.CORRECT, baseTime);
      expect(result.bucket).toBe(2);
    });

    it('maintains bucket on PARTIAL', () => {
      const result = calculateNextReview(2, 0, 0, GradeStatus.PARTIAL, baseTime);
      expect(result.bucket).toBe(2);
    });

    it('decrements bucket on INCORRECT', () => {
      const result = calculateNextReview(2, 0, 0, GradeStatus.INCORRECT, baseTime);
      expect(result.bucket).toBe(1);
    });
  });

  describe('bucket clamping', () => {
    it('caps bucket at MAX_BUCKET on CORRECT', () => {
      const result = calculateNextReview(MAX_BUCKET, 0, 0, GradeStatus.CORRECT, baseTime);
      expect(result.bucket).toBe(MAX_BUCKET);
    });

    it('floors bucket at 0 on INCORRECT', () => {
      const result = calculateNextReview(0, 0, 0, GradeStatus.INCORRECT, baseTime);
      expect(result.bucket).toBe(0);
    });
  });

  describe('nextReviewAt calculation', () => {
    it('sets nextReviewAt based on new bucket interval', () => {
      // Bucket 0 → 1 day interval
      const result = calculateNextReview(0, 0, 0, GradeStatus.PARTIAL, baseTime);
      expect(result.nextReviewAt).toBe(baseTime + 1 * DAY_MS);
    });

    it('uses correct interval for each bucket', () => {
      // Bucket 2 → 7 days
      const result = calculateNextReview(2, 0, 0, GradeStatus.PARTIAL, baseTime);
      expect(result.nextReviewAt).toBe(baseTime + 7 * DAY_MS);
    });

    it('uses new bucket interval after advancement', () => {
      // Bucket 1 → 2 on CORRECT → 7 days
      const result = calculateNextReview(1, 0, 0, GradeStatus.CORRECT, baseTime);
      expect(result.bucket).toBe(2);
      expect(result.nextReviewAt).toBe(baseTime + 7 * DAY_MS);
    });
  });

  describe('counter updates', () => {
    it('increments timesCorrect on CORRECT', () => {
      const result = calculateNextReview(1, 5, 2, GradeStatus.CORRECT, baseTime);
      expect(result.timesCorrect).toBe(6);
      expect(result.timesIncorrect).toBe(2);
    });

    it('increments timesIncorrect on INCORRECT', () => {
      const result = calculateNextReview(1, 5, 2, GradeStatus.INCORRECT, baseTime);
      expect(result.timesCorrect).toBe(5);
      expect(result.timesIncorrect).toBe(3);
    });

    it('does not increment counters on PARTIAL', () => {
      const result = calculateNextReview(1, 5, 2, GradeStatus.PARTIAL, baseTime);
      expect(result.timesCorrect).toBe(5);
      expect(result.timesIncorrect).toBe(2);
    });
  });

  describe('default nowMs', () => {
    it('uses Date.now() when nowMs not provided', () => {
      const before = Date.now();
      const result = calculateNextReview(0, 0, 0, GradeStatus.PARTIAL);
      const after = Date.now();

      // nextReviewAt should be within 1 day of now (±100ms for test execution)
      expect(result.nextReviewAt).toBeGreaterThanOrEqual(before + DAY_MS);
      expect(result.nextReviewAt).toBeLessThanOrEqual(after + DAY_MS);
    });
  });
});

describe('isDue', () => {
  it('returns true when nextReviewAt is in the past', () => {
    const now = Date.now();
    expect(isDue(now - 1000, now)).toBe(true);
  });

  it('returns true when nextReviewAt equals now', () => {
    const now = Date.now();
    expect(isDue(now, now)).toBe(true);
  });

  it('returns false when nextReviewAt is in the future', () => {
    const now = Date.now();
    expect(isDue(now + 1000, now)).toBe(false);
  });

  it('uses Date.now() when nowMs not provided', () => {
    const past = Date.now() - 1000;
    expect(isDue(past)).toBe(true);

    const future = Date.now() + 10000;
    expect(isDue(future)).toBe(false);
  });
});
