import { describe, it, expect } from 'vitest';
import { computeStreak, getCurrentStreak } from './streak';

const DAY_MS = 86_400_000;

describe('computeStreak', () => {
  it('returns 1 for first session', () => {
    const result = computeStreak({
      prevStreak: 0,
      prevLastSessionAtMs: 0,
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result.nextStreak).toBe(1);
    expect(result.didIncrement).toBe(true);
  });

  it('increments on next day', () => {
    const yesterday = Date.now() - DAY_MS;
    const result = computeStreak({
      prevStreak: 5,
      prevLastSessionAtMs: yesterday,
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result.nextStreak).toBe(6);
    expect(result.didIncrement).toBe(true);
  });

  it('resets on gap > 1 day', () => {
    const threeDaysAgo = Date.now() - 3 * DAY_MS;
    const result = computeStreak({
      prevStreak: 10,
      prevLastSessionAtMs: threeDaysAgo,
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result.nextStreak).toBe(1);
  });
});

describe('getCurrentStreak', () => {
  it('returns stored streak if session was today', () => {
    const result = getCurrentStreak({
      streak: 5,
      lastSessionAtMs: Date.now() - 1000, // 1 second ago
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result).toBe(5);
  });

  it('returns stored streak if session was yesterday', () => {
    const result = getCurrentStreak({
      streak: 5,
      lastSessionAtMs: Date.now() - DAY_MS,
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result).toBe(5);
  });

  it('returns 0 if session was 2+ days ago', () => {
    const result = getCurrentStreak({
      streak: 5,
      lastSessionAtMs: Date.now() - 2 * DAY_MS,
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result).toBe(0);
  });

  it('returns 0 if no previous session', () => {
    const result = getCurrentStreak({
      streak: 0,
      lastSessionAtMs: 0,
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result).toBe(0);
  });

  it('returns 0 if session was weeks ago', () => {
    const twoWeeksAgo = Date.now() - 14 * DAY_MS;
    const result = getCurrentStreak({
      streak: 2, // the bug scenario
      lastSessionAtMs: twoWeeksAgo,
      nowMs: Date.now(),
      tzOffsetMin: 0,
    });
    expect(result).toBe(0);
  });
});
