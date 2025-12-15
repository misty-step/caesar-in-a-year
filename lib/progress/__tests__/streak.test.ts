import { describe, it, expect } from 'vitest';
import { computeStreak } from '../streak';

describe('computeStreak', () => {
  // Use a fixed timezone offset for testing (UTC-5 = 300 minutes)
  const tzOffsetMin = 300;
  const DAY_MS = 86_400_000;

  // Helper to create a timestamp at a specific local day index
  function localDayStart(dayIndex: number): number {
    // Reverse the local day calculation: localMs = dayIndex * DAY_MS
    // tsMs = localMs + tzOffsetMin * 60_000
    return dayIndex * DAY_MS + tzOffsetMin * 60_000;
  }

  it('starts streak at 1 for first session', () => {
    const nowMs = localDayStart(100) + 3600_000; // Mid-day on day 100
    const result = computeStreak({
      prevStreak: 0,
      prevLastSessionAtMs: 0,
      nowMs,
      tzOffsetMin,
    });
    expect(result.nextStreak).toBe(1);
    expect(result.didIncrement).toBe(true);
    expect(result.nextLastSessionAtMs).toBe(nowMs);
  });

  it('keeps streak unchanged for same local day', () => {
    const day100Start = localDayStart(100);
    const prevMs = day100Start + 3600_000; // 1 hour into day 100
    const nowMs = day100Start + 7200_000;  // 2 hours into day 100

    const result = computeStreak({
      prevStreak: 5,
      prevLastSessionAtMs: prevMs,
      nowMs,
      tzOffsetMin,
    });
    expect(result.nextStreak).toBe(5);
    expect(result.didIncrement).toBe(false);
  });

  it('increments streak for next local day', () => {
    const day100Start = localDayStart(100);
    const day101Start = localDayStart(101);
    const prevMs = day100Start + 3600_000; // Day 100
    const nowMs = day101Start + 3600_000;  // Day 101

    const result = computeStreak({
      prevStreak: 5,
      prevLastSessionAtMs: prevMs,
      nowMs,
      tzOffsetMin,
    });
    expect(result.nextStreak).toBe(6);
    expect(result.didIncrement).toBe(true);
  });

  it('resets streak to 1 when missing a day', () => {
    const day100Start = localDayStart(100);
    const day102Start = localDayStart(102); // Skipped day 101
    const prevMs = day100Start + 3600_000;
    const nowMs = day102Start + 3600_000;

    const result = computeStreak({
      prevStreak: 5,
      prevLastSessionAtMs: prevMs,
      nowMs,
      tzOffsetMin,
    });
    expect(result.nextStreak).toBe(1);
    expect(result.didIncrement).toBe(true);
  });

  it('resets streak to 1 when missing multiple days', () => {
    const day100Start = localDayStart(100);
    const day110Start = localDayStart(110); // Skipped 9 days
    const prevMs = day100Start + 3600_000;
    const nowMs = day110Start + 3600_000;

    const result = computeStreak({
      prevStreak: 50,
      prevLastSessionAtMs: prevMs,
      nowMs,
      tzOffsetMin,
    });
    expect(result.nextStreak).toBe(1);
    expect(result.didIncrement).toBe(true);
  });

  it('handles different timezone offsets', () => {
    // Test with UTC (offset = 0)
    const day100StartUTC = 100 * DAY_MS;
    const day101StartUTC = 101 * DAY_MS;

    const result = computeStreak({
      prevStreak: 3,
      prevLastSessionAtMs: day100StartUTC + 3600_000,
      nowMs: day101StartUTC + 3600_000,
      tzOffsetMin: 0,
    });
    expect(result.nextStreak).toBe(4);
    expect(result.didIncrement).toBe(true);
  });

  it('handles edge case at midnight boundary', () => {
    const day100Start = localDayStart(100);
    const day101Start = localDayStart(101);
    const prevMs = day100Start + DAY_MS - 1000; // Just before midnight
    const nowMs = day101Start + 1000;           // Just after midnight

    const result = computeStreak({
      prevStreak: 7,
      prevLastSessionAtMs: prevMs,
      nowMs,
      tzOffsetMin,
    });
    expect(result.nextStreak).toBe(8);
    expect(result.didIncrement).toBe(true);
  });
});
