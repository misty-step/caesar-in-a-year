/**
 * Pure streak computation logic.
 * Uses user-provided timezone offset to determine local day.
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
