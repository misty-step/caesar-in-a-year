# Implementation Retro

## #76 — Fix AI rate limit bypass in vocab-review and phrase-review

**Date**: 2026-02-23
**Predicted effort**: S
**Actual effort**: S (accurate)

**Scope changes**:
- Added: dead `GradeStatus` import removal (discovered during polish)
- Added: shared-pool documentation test in `inMemoryRateLimit.test.ts` (AC#4 gap found in hindsight review)
- Deferred: graceful fallback → #93; quota placement → #92

**Blockers**: None

**Pattern for future scoping**:
Security fixes on "copy the guard" class are S. Add 0.5 size for each new test file needed (2 here). Add 0.5 if the fix touches a pattern already in a different route (check for behavioral divergence with similar routes up front). ADR violations surfaced by bots are expected for security-vs-UX tradeoffs — pre-answer them in the issue.

---

## #90 — Add first-session guidance card to dashboard for Day 1 users

**Date**: 2026-02-28
**Predicted effort**: S
**Actual effort**: S (accurate)

**Scope changes**:
- Issue referenced `totalSessionsCompleted` but that field doesn't exist in `UserProgress` type — used `rawProgress === null` as equivalent signal
- Used `localStorage` for dismissal persistence (issue listed it as optional but AC required "does not appear again")

**Blockers**: None

**Pattern for future scoping**:
New dashboard card components are S. Pattern is well-established (see JustCompletedBanner, TrialBanner). Client components with localStorage for persistence are straightforward. Check that data types in issue match actual codebase types — field names may have diverged since issue was written.

---
