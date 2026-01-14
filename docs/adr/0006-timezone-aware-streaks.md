# ADR 0006: Timezone-Aware Streak Calculation

## Status
Accepted

## Context
Streaks are a key gamification feature. "Consecutive days" must be defined consistently for users across time zones. Server timestamps are UTC but users think in local days.

**Problem:** A user in PST completing sessions at 11pm local time should not lose streak at midnight UTC.

**Alternatives considered:**
1. Pure UTC calculation - punishes users in western time zones
2. Fixed timezone (e.g., user-configured) - requires user setup, edge cases at DST
3. Client-provided offset at request time - no storage, handles DST implicitly

## Decision
Client sends `Date.getTimezoneOffset()` (minutes behind UTC) with each session completion and progress fetch. Server uses this offset to calculate "local day index":

```typescript
function localDayIndex(tsMs: number, tzOffsetMin: number): number {
  const localMs = tsMs - tzOffsetMin * 60_000;
  return Math.floor(localMs / DAY_MS);
}
```

**Streak rules:**
- First session: streak = 1
- Same local day: streak unchanged
- Next local day: streak + 1
- Gap > 1 day: streak = 1

**Display rule:** `getCurrentStreak()` returns 0 if last session was more than 1 local day ago (decayed streak shown immediately).

## Consequences

**Good:**
- Users in all time zones get fair streak calculation
- No timezone storage/configuration required
- DST changes handled implicitly (offset changes with client clock)

**Bad:**
- Offset is provided by client (could be spoofed, but low stakes)
- Off-by-one possible at DST boundary (acceptable for gamification)
- Negative `tzOffsetMin` (UTC+X zones) requires careful math

**Why not store user timezone?**
- Adds onboarding friction
- User might travel and expect streak to adapt
- `getTimezoneOffset()` is the actual user context at request time
