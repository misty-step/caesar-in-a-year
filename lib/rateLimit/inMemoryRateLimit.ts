/**
 * In-memory per-user rate limiter for AI calls.
 * Fixed window: 100 calls per 60 minutes per user.
 * Process-local only (OK for MVP single-instance).
 */

const WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const MAX_CALLS = 100;

export type RateLimitDecision =
  | { allowed: true; remaining: number; resetAtMs: number }
  | { allowed: false; remaining: 0; resetAtMs: number };

interface UserWindow {
  windowStartMs: number;
  count: number;
}

// Process-local state
const userWindows = new Map<string, UserWindow>();

/**
 * Check and consume one AI call for a user.
 * Never throws; worst case allows the call.
 */
export function consumeAiCall(userId: string, nowMs: number): RateLimitDecision {
  try {
    const existing = userWindows.get(userId);
    const resetAtMs = (existing?.windowStartMs ?? nowMs) + WINDOW_MS;

    // Reset window if expired
    if (!existing || nowMs - existing.windowStartMs >= WINDOW_MS) {
      userWindows.set(userId, { windowStartMs: nowMs, count: 1 });
      return { allowed: true, remaining: MAX_CALLS - 1, resetAtMs: nowMs + WINDOW_MS };
    }

    // Within window
    if (existing.count < MAX_CALLS) {
      existing.count++;
      return { allowed: true, remaining: MAX_CALLS - existing.count, resetAtMs };
    }

    // Limit exceeded
    return { allowed: false, remaining: 0, resetAtMs };
  } catch {
    // Never block learning due to rate limit bugs
    console.warn("Rate limit check failed, allowing call");
    return { allowed: true, remaining: MAX_CALLS, resetAtMs: nowMs + WINDOW_MS };
  }
}

/**
 * Reset rate limit state (for testing).
 */
export function _resetForTesting(): void {
  userWindows.clear();
}
