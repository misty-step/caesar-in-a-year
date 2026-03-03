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

## #86 — Fix isReturningUser copy inversion on subscribe page

**Date**: 2026-02-28
**Predicted effort**: S
**Actual effort**: S (accurate)

**Scope changes**:
- Added: subscribe page test file (no prior test coverage for this page)

**Blockers**: None

**Pattern for future scoping**:
UI copy logic bugs where the condition is wrong (not the copy itself) are XS-S. One-line conditional fix + new test file = S. Pre-existing test infra issues (bun runner compat with vitest APIs) are not blockers for targeted test files that avoid those APIs.

---

## #85 — Add session recap to summary screen

**Date**: 2026-02-28
**Predicted effort**: S
**Actual effort**: S (accurate)

**Scope changes**:
- Removed duplicate "To Dashboard" button from SummaryCard (page.tsx already renders CTAs)
- Eliminated duplicate `getUserProgress` call by reusing the one fetched for recap in the mastery check

**Blockers**: None

**Pattern for future scoping**:
Features adding new data to existing screens are reliably S when the data layer already stores what's needed (attempts table existed). The Convex index addition (`by_user_session`) is a schema migration that needs deploy coordination. When extending component props, check all callers (tests, page.tsx) — mock updates are easy to miss.

---

## #123 — P0: Fix dashboard crash (corpus static import)

| Field | Value |
|-------|-------|
| Issue | #123 |
| PR | #130 |
| Predicted effort | — |
| Actual effort | S (< 1 hour) |
| Scope changes | None — issue spec was accurate and complete |
| Blockers | Could not do authenticated dogfood QA (no test credentials); verified via build + 310 tests instead |
| Pattern | Dynamic `fs.readFile(process.cwd() + path)` in serverless = silent ENOENT. Static `import` from `@/` path is the fix. Documented in CLAUDE.md global memory. |

---

## #38 — Add Stripe subscription reconciliation job

| Field | Value |
|-------|-------|
| Issue | #38 |
| PR | #135 |
| Predicted effort | M |
| Actual effort | M (~3 hours incl. pre-push gates) |
| Scope changes | Added pure reconciliation module + unit tests + Convex cron + architecture note |
| Blockers | `bd` and `/dogfood` CLIs unavailable in this environment; used GitHub issue flow + backend-focused verification |
| Pattern | Reconciliation logic is safer as a pure module with deterministic tests; keep cron default log-only and gate mutation with explicit flag |
