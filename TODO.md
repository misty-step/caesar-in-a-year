# TODO: FSRS Integration

## Context
- Architecture: Thin wrapper over ts-fsrs (see DESIGN.md)
- Key Files: `lib/srs/fsrs.ts`, `convex/schema.ts`, `convex/reviews.ts`, `lib/data/convexAdapter.ts`
- Patterns: Follow existing Convex mutation/query patterns in `convex/reviews.ts`

## Implementation Tasks

- [x] Add ts-fsrs dependency
  ```
  Files: package.json
  Command: pnpm add ts-fsrs
  Success: ts-fsrs in dependencies, types available
  Test: import { fsrs, Rating } from 'ts-fsrs' compiles
  Dependencies: None (first task)
  Time: 5min
  ```

- [x] Create lib/srs/fsrs.ts with mapGradeToRating and scheduleReview
  ```
  Files: lib/srs/fsrs.ts (new)
  Architecture: See DESIGN.md Module Design - lib/srs/fsrs.ts
  Pseudocode:
    - mapGradeToRating: INCORRECT→Again, PARTIAL→Hard, CORRECT→Good
    - scheduleReview: null→createEmptyCard, then f.repeat(card, now)[rating].card
  Success: Both functions exported, types match DESIGN.md interface
  Test: Unit tests in next task
  Dependencies: ts-fsrs installed
  Time: 20min
  ```

- [x] Create lib/srs/__tests__/fsrs.test.ts with unit tests
  ```
  Files: lib/srs/__tests__/fsrs.test.ts (new)
  Architecture: See DESIGN.md Testing Strategy
  Tests:
    - mapGradeToRating: all 3 mappings
    - scheduleReview: new card, stability increase, relearning on fail, reps/lapses counters
  Success: pnpm test passes, 100% coverage on fsrs.ts
  Dependencies: lib/srs/fsrs.ts exists
  Time: 30min
  ```

- [x] Update convex/schema.ts with FSRS fields
  ```
  Files: convex/schema.ts:27-37
  Architecture: See DESIGN.md Module Design - convex/schema.ts
  Changes:
    - Remove: bucket, timesCorrect, timesIncorrect
    - Rename: lastReviewedAt → lastReview (optional)
    - Add: state, stability, difficulty, elapsedDays, scheduledDays, learningSteps, reps, lapses
  Success: npx convex dev succeeds, schema deployed
  Test: Convex dashboard shows new fields
  Dependencies: None (can parallel with fsrs.ts)
  Time: 15min
  ```

- [x] Update convex/reviews.ts mutation and queries
  ```
  Files: convex/reviews.ts
  Architecture: See DESIGN.md Module Design - convex/reviews.ts
  Changes:
    - record mutation: new args (state, stability, difficulty, etc.)
    - getStats query: masteredCount uses stability >= 21 instead of bucket >= 4
    - Remove: MASTERED_BUCKET constant
    - Add: MASTERED_STABILITY_THRESHOLD = 21
  Success: Mutations accept new fields, queries return correct stats
  Test: Manual test via Convex dashboard
  Dependencies: convex/schema.ts updated
  Time: 25min
  ```

- [x] Update lib/data/convexAdapter.ts to use FSRS
  ```
  Files: lib/data/convexAdapter.ts:18, 170-188
  Architecture: See DESIGN.md Module Design - lib/data/convexAdapter.ts
  Changes:
    - Import from '@/lib/srs/fsrs' instead of './srs'
    - Add reconstructCard helper function
    - Add stateToString/parseState helpers
    - Update recordReview to use scheduleReview and new mutation args
  Success: recordReview calls scheduleReview, persists all FSRS fields
  Test: Integration test (review sentence → check Convex dashboard for FSRS fields)
  Dependencies: lib/srs/fsrs.ts, convex/reviews.ts updated
  Time: 30min
  ```

- [x] Delete old bucket SRS code
  ```
  Files:
    - lib/data/srs.ts (delete)
    - lib/data/__tests__/srs.test.ts (delete)
  Success: No references to calculateNextReview, isDue, BUCKET_INTERVALS
  Test: pnpm build succeeds, no dead code
  Dependencies: convexAdapter.ts no longer imports from ./srs
  Time: 10min
  ```

## Verification

After all tasks complete:
1. `pnpm test` — all tests pass
2. `pnpm build` — no type errors
3. Manual test: grade sentence → check Convex dashboard → verify FSRS fields populated
4. Manual test: CORRECT → due in minutes (learning), INCORRECT → stability drops
