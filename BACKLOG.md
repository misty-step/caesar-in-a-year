# Backlog

## Checkpoint 1: Core Loop Integrity

FSRS works, grading correct, stats update.

| ID | Task | Files | Status |
|----|------|-------|--------|
| 1.1 | Create distinct gist grading prompt for reading passages | `lib/ai/gradeGist.ts` (new) | TODO |
| 1.2 | Add in-memory rate limiting (100/hr per user) | `app/api/grade/route.ts` | TODO |
| 1.3 | Update streak/XP on session completion | `app/(app)/summary/[sessionId]/page.tsx` | TODO |
| 1.4 | Add tests for session advancement edge cases | `lib/session/__tests__/advance.test.ts` | TODO |
| 1.5 | Add test for FSRS recording | `lib/data/__tests__/convexAdapter.test.ts` | TODO |

---

## Checkpoint 2: Code Health

Remove dead code, consolidate types.

| ID | Task | Files | Status |
|----|------|-------|--------|
| 2.1 | Delete dead components | `components/Dashboard.tsx`, `components/Layout.tsx` | TODO |
| 2.2 | Consolidate type definitions | `types.ts` → `lib/data/types.ts` | TODO |
| 2.3 | Remove orphaned API route | `app/api/session/advance/` | TODO |

---

═══════════════════════════════════════════════════════════════════════════════
                              MVP LAUNCH LINE
═══════════════════════════════════════════════════════════════════════════════

---

## Checkpoint 3: Polish & UX

- Loading states / skeleton loaders
- Error boundaries
- Mobile optimization
- Celebration animations
- Keyboard shortcuts
- Upgrade rate limiting to Upstash Redis

---

## Checkpoint 4: Growth Features

- Placement quiz
- Teacher mode / assignment sharing
- Progress sharing / social
- Advanced analytics
- Content expansion (more Caesar, other texts)

---

## Technical Debt

| Item | Effort | Notes |
|------|--------|-------|
| Resolve recordAttempt stub | S-M | Currently no-op; implement or delete |
| Centralize FSRS config | S | `MASTERED_STABILITY_THRESHOLD` scattered |
| Optimize stats queries | M | Replace O(N) `.collect()` with counters |
| Add FsrsReviewState type | S | Explicit type for review data |
| Improve docstring coverage | M | `lib/srs/`, `lib/data/` |
| Cross-platform corpus pipeline | S | Windows Python paths |

---

## Completed

- [x] Phase 1: Corpus Processing - Parsed De Bello Gallico with difficulty scores
- [x] Phase 2: Convex Persistence - Schema and DataAdapter abstraction
- [x] Phase 3: FSRS Implementation - ts-fsrs wrapper
- [x] Phase 4: Content Selection - Difficulty-based with narrative ordering
- [x] Phase 5: Level Advancement - Mastery counting and progression UI
- [x] 0.1: advanceSession bug fix
- [x] 0.2: recordReview wiring
