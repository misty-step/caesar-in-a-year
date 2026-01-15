/**
 * Pure streak computation logic.
 * Uses user-provided timezone offset to determine local day.
 *
 * State machine: NO_STREAK -> STREAK_1 -> STREAK_N -> DECAYED -> STREAK_1
 * Rules: same day = unchanged, next day = increment, gap > 1 = reset to 1.
 * See docs/architecture/session-flow.md for full diagram.
 */

const DAY_MS = 86_400_000;

export interface StreakInput {
  prevStreak: number;
  prevLastSessionAtMs: number; // 0 if none
  nowMs: number; // server time
  tzOffsetMin: number; // from client (Date.getTimezoneOffset())
}

export interface StreakResult {
  nextStreak: number;
  nextLastSessionAtMs: number;
  didIncrement: boolean;
}

/**
 * Compute the local day index for a timestamp given a timezone offset.
 * Uses best-effort math; may be off by 1 at DST boundaries.
 */
function localDayIndex(tsMs: number, tzOffsetMin: number): number {
  // Note: getTimezoneOffset() returns minutes *behind* UTC (positive for west)
  // So UTC-5 (EST) returns 300, meaning local = UTC - 300min
  // To get local time: tsMs - (tzOffsetMin * 60_000)
  const localMs = tsMs - tzOffsetMin * 60_000;
  return Math.floor(localMs / DAY_MS);
}

/**
 * Compute next streak value based on session completion.
 *
 * Rules (MVP):
 * - First completion → streak=1
 * - Same local day → streak unchanged
 * - Next local day → streak+1
 * - Gap > 1 day → streak=1
 */
export function computeStreak(params: StreakInput): StreakResult {
  const { prevStreak, prevLastSessionAtMs, nowMs, tzOffsetMin } = params;

  // First session ever
  if (prevLastSessionAtMs === 0) {
    return {
      nextStreak: 1,
      nextLastSessionAtMs: nowMs,
      didIncrement: true,
    };
  }

  const prevDay = localDayIndex(prevLastSessionAtMs, tzOffsetMin);
  const nowDay = localDayIndex(nowMs, tzOffsetMin);
  const dayDiff = nowDay - prevDay;

  if (dayDiff === 0) {
    // Same local day → streak unchanged
    return {
      nextStreak: prevStreak,
      nextLastSessionAtMs: nowMs,
      didIncrement: false,
    };
  }

  if (dayDiff === 1) {
    // Next local day → increment
    return {
      nextStreak: prevStreak + 1,
      nextLastSessionAtMs: nowMs,
      didIncrement: true,
    };
  }

  // Gap > 1 day (or negative, which shouldn't happen but handle gracefully)
  return {
    nextStreak: 1,
    nextLastSessionAtMs: nowMs,
    didIncrement: true,
  };
}

/**
 * Get current effective streak value for display.
 * Returns 0 if streak has decayed (no activity for >1 day).
 */
export function getCurrentStreak(params: {
  streak: number;
  lastSessionAtMs: number;
  nowMs: number;
  tzOffsetMin: number;
}): number {
  const { streak, lastSessionAtMs, nowMs, tzOffsetMin } = params;

  if (lastSessionAtMs === 0) return 0;

  const lastDay = localDayIndex(lastSessionAtMs, tzOffsetMin);
  const nowDay = localDayIndex(nowMs, tzOffsetMin);
  const dayDiff = nowDay - lastDay;

  // Streak is valid if last session was today or yesterday
  if (dayDiff <= 1) return streak;

  // Streak has decayed
  return 0;
}
