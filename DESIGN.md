# DESIGN.md — FSRS Integration (Phase 2)

> This document supersedes the Phase 1 Convex Persistence architecture. The bucket-based SRS system is replaced with FSRS.

## Architecture Overview

**Selected Approach**: Thin wrapper over ts-fsrs

**Rationale**: ts-fsrs is well-designed with clean interfaces. We expose minimal surface area: a rating mapper and a scheduling function. No abstraction layers, no adapters—just direct library use with type-safe wrappers.

**Core Modules**:
- `lib/srs/fsrs.ts`: Rating mapping + scheduling (replaces `lib/data/srs.ts`)
- `convex/schema.ts`: Updated sentenceReviews table with FSRS card fields
- `convex/reviews.ts`: Updated mutations to accept FSRS card state
- `lib/data/convexAdapter.ts`: Call new FSRS functions instead of bucket algorithm

**Data Flow**:
```
ReviewStep.tsx → gradeTranslation() → GradingResult
                                           ↓
                          convexAdapter.recordReview()
                                           ↓
                          scheduleReview(card, status)
                                           ↓
                          api.reviews.record(fsrsFields)
```

**Key Design Decisions**:
1. **Direct library use**: No intermediate abstraction. ts-fsrs types used in adapter.
2. **3-rating mapping**: Map CORRECT→Good, PARTIAL→Hard, INCORRECT→Again. Never use Easy (no signal for effortless recall in quiz-based grading).
3. **Clean slate migration**: Reset all reviews to `state = "new"`. Simpler than reverse-engineering FSRS state from bucket history.
4. **Store all FSRS fields**: Persist complete Card state for future features (analytics, parameter tuning).

---

## Module Design

### Module: `lib/srs/fsrs.ts` (NEW)

**Responsibility**: Map grading outcomes to FSRS ratings; compute next card state. Hides ts-fsrs initialization and Rating enum from callers.

**Public Interface**:
```typescript
import type { Card, State } from 'ts-fsrs';
import { GradeStatus } from '@/types';

// Re-export for consumers
export type { Card };
export { createEmptyCard, Rating, State } from 'ts-fsrs';

/**
 * Convert GradeStatus to FSRS Rating.
 * INCORRECT → Again (forgot, relearn)
 * PARTIAL   → Hard  (struggled, slow advance)
 * CORRECT   → Good  (recalled, normal advance)
 */
export function mapGradeToRating(status: GradeStatus): Rating;

/**
 * Schedule next review based on current card state and grading result.
 *
 * @param card - Current card state (null for first review → creates new card)
 * @param status - Grading outcome
 * @param now - Review timestamp (defaults to new Date())
 * @returns Updated card with new due date, stability, difficulty, etc.
 */
export function scheduleReview(
  card: Card | null,
  status: GradeStatus,
  now?: Date
): Card;
```

**Internal Implementation**:
```pseudocode
const RETENTION_TARGET = 0.90  // FSRS default, tune after data collection
const scheduler = fsrs({ requestRetention: RETENTION_TARGET })

function mapGradeToRating(status):
  switch status:
    INCORRECT → Rating.Again
    PARTIAL   → Rating.Hard
    CORRECT   → Rating.Good
  // Never Rating.Easy — no "effortless" signal in quiz grading

function scheduleReview(card, status, now = new Date()):
  1. If card is null:
     - currentCard = createEmptyCard(now)
  2. Else:
     - currentCard = card

  3. rating = mapGradeToRating(status)
  4. schedulingCards = scheduler.repeat(currentCard, now)
  5. return schedulingCards[rating].card
```

**Dependencies**:
- Requires: `ts-fsrs` (npm package, to be added)
- Used by: `lib/data/convexAdapter.ts`

**Data Structures** (from ts-fsrs):
```typescript
// ts-fsrs Card type (what we store)
interface Card {
  due: Date;                     // When next review is due
  stability: number;             // Memory stability (days)
  difficulty: number;            // Card difficulty (1-10 scale in FSRS)
  elapsed_days: number;          // Days since last review
  scheduled_days: number;        // Days until next review
  reps: number;                  // Total review count
  lapses: number;                // Times forgotten (Again count)
  state: State;                  // New, Learning, Review, Relearning
  last_review?: Date;            // Last review timestamp
}

// ts-fsrs State enum
enum State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

// ts-fsrs Rating enum
enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}
```

**Error Handling**:
- Invalid GradeStatus → TypeScript compile error (exhaustive switch)
- ts-fsrs internal errors → let bubble up (library is stable)

---

### Module: `convex/schema.ts` (UPDATE)

**Responsibility**: Define sentenceReviews table with FSRS card fields.

**Schema Change**:
```typescript
// BEFORE (bucket-based)
sentenceReviews: defineTable({
  userId: v.string(),
  sentenceId: v.string(),
  bucket: v.number(),             // DELETE
  nextReviewAt: v.number(),       // KEEP (for due index)
  lastReviewedAt: v.number(),     // RENAME → lastReview
  timesCorrect: v.number(),       // DELETE (replaced by reps)
  timesIncorrect: v.number(),     // DELETE (replaced by lapses)
})

// AFTER (FSRS-based)
sentenceReviews: defineTable({
  userId: v.string(),
  sentenceId: v.string(),

  // FSRS card state
  state: v.union(
    v.literal('new'),
    v.literal('learning'),
    v.literal('review'),
    v.literal('relearning')
  ),
  stability: v.number(),          // Days until 90% forgetting
  difficulty: v.number(),         // 1-10 scale
  elapsedDays: v.number(),        // Days since last review
  scheduledDays: v.number(),      // Days until next review
  reps: v.number(),               // Total review count
  lapses: v.number(),             // Times forgotten (Again count)
  lastReview: v.optional(v.number()),  // Unix ms, optional for new cards

  // Indexed for due queries
  nextReviewAt: v.number(),       // Unix ms (from card.due)
})
  .index("by_user_due", ["userId", "nextReviewAt"])
  .index("by_user_sentence", ["userId", "sentenceId"])
```

**Index Strategy** (unchanged):
- `by_user_due`: Query due reviews sorted by scheduled time
- `by_user_sentence`: Lookup specific user+sentence pair

---

### Module: `convex/reviews.ts` (UPDATE)

**Responsibility**: CRUD for sentenceReviews with FSRS fields.

**Mutation Interface Change**:
```typescript
// BEFORE
export const record = mutation({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
    bucket: v.number(),
    nextReviewAt: v.number(),
    lastReviewedAt: v.number(),
    timesCorrect: v.number(),
    timesIncorrect: v.number(),
  },
  // ...
});

// AFTER
export const record = mutation({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
    // FSRS card state
    state: v.union(
      v.literal('new'),
      v.literal('learning'),
      v.literal('review'),
      v.literal('relearning')
    ),
    stability: v.number(),
    difficulty: v.number(),
    elapsedDays: v.number(),
    scheduledDays: v.number(),
    reps: v.number(),
    lapses: v.number(),
    lastReview: v.optional(v.number()),
    nextReviewAt: v.number(),
  },
  // ...
});
```

**Query Changes**:
```typescript
// getStats: Update mastered calculation
// BEFORE: bucket >= MASTERED_BUCKET (4)
// AFTER: state === 'review' && stability >= MASTERED_STABILITY_THRESHOLD

const MASTERED_STABILITY_THRESHOLD = 21; // ~3 weeks stability = mastered

export const getStats = query({
  // ...
  handler: async (ctx, { userId }) => {
    // Due count: same (uses nextReviewAt index)
    // Mastered count: stability >= 21 days AND state === 'review'
    const masteredCount = allReviews.filter(
      r => r.state === 'review' && r.stability >= MASTERED_STABILITY_THRESHOLD
    ).length;
    // ...
  },
});
```

**getOne Query Change**:
```typescript
// Return FSRS fields instead of bucket fields
export const getOne = query({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
  },
  handler: async (ctx, { userId, sentenceId }) => {
    // ... auth check ...
    return ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) =>
        q.eq("userId", userId).eq("sentenceId", sentenceId)
      )
      .unique();
    // Returns: { state, stability, difficulty, elapsedDays, scheduledDays, reps, lapses, lastReview, nextReviewAt }
  },
});
```

---

### Module: `lib/data/convexAdapter.ts` (UPDATE)

**Responsibility**: Bridge between session logic and Convex persistence.

**Change Summary**:
```typescript
// BEFORE
import { calculateNextReview } from './srs';

// AFTER
import { scheduleReview, createEmptyCard, State, type Card } from '@/lib/srs/fsrs';
```

**Updated recordReview Method**:
```pseudocode
async recordReview(userId, sentenceId, result):
  1. Fetch existing review (if any)
     existing = await fetchQuery(api.reviews.getOne, { userId, sentenceId })

  2. Build current Card from existing data (or null for new)
     if existing:
       currentCard = reconstructCard(existing)
     else:
       currentCard = null

  3. Schedule next review
     newCard = scheduleReview(currentCard, result.status)

  4. Persist to Convex
     await fetchMutation(api.reviews.record, {
       userId,
       sentenceId,
       state: mapStateToString(newCard.state),
       stability: newCard.stability,
       difficulty: newCard.difficulty,
       elapsedDays: newCard.elapsed_days,
       scheduledDays: newCard.scheduled_days,
       reps: newCard.reps,
       lapses: newCard.lapses,
       lastReview: newCard.last_review?.getTime(),
       nextReviewAt: newCard.due.getTime(),
     })
```

**Helper Functions**:
```typescript
// Reconstruct ts-fsrs Card from stored fields
function reconstructCard(stored: ConvexReviewDoc): Card {
  return {
    due: new Date(stored.nextReviewAt),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsedDays,
    scheduled_days: stored.scheduledDays,
    reps: stored.reps,
    lapses: stored.lapses,
    state: parseState(stored.state),
    last_review: stored.lastReview ? new Date(stored.lastReview) : undefined,
  };
}

// State enum ↔ string conversion
function mapStateToString(state: State): StoredState {
  const mapping = ['new', 'learning', 'review', 'relearning'] as const;
  return mapping[state];
}

function parseState(stored: StoredState): State {
  const mapping = { new: 0, learning: 1, review: 2, relearning: 3 };
  return mapping[stored] as State;
}

type StoredState = 'new' | 'learning' | 'review' | 'relearning';
```

---

## File Organization

```
lib/srs/
  fsrs.ts                    # NEW: ts-fsrs wrapper
  __tests__/
    fsrs.test.ts             # NEW: unit tests

lib/data/
  srs.ts                     # DELETE after migration
  __tests__/
    srs.test.ts              # DELETE after migration
  convexAdapter.ts           # UPDATE: use fsrs.ts instead of srs.ts
  types.ts                   # NO CHANGE

convex/
  schema.ts                  # UPDATE: new sentenceReviews fields
  reviews.ts                 # UPDATE: mutations for new schema
```

**Migration Order**:
1. `pnpm add ts-fsrs` — add dependency
2. Create `lib/srs/fsrs.ts` + tests — new module
3. Update `convex/schema.ts` — schema migration
4. Update `convex/reviews.ts` — mutation changes
5. Update `lib/data/convexAdapter.ts` — switch to FSRS
6. Delete `lib/data/srs.ts` + tests — cleanup
7. Clear existing review data (clean slate migration)

---

## Testing Strategy

### Unit Tests: `lib/srs/__tests__/fsrs.test.ts`

**Test Boundaries**: Public API only (mapGradeToRating, scheduleReview)

```typescript
describe('mapGradeToRating', () => {
  it('maps INCORRECT to Again', () => {
    expect(mapGradeToRating(GradeStatus.INCORRECT)).toBe(Rating.Again);
  });

  it('maps PARTIAL to Hard', () => {
    expect(mapGradeToRating(GradeStatus.PARTIAL)).toBe(Rating.Hard);
  });

  it('maps CORRECT to Good', () => {
    expect(mapGradeToRating(GradeStatus.CORRECT)).toBe(Rating.Good);
  });
});

describe('scheduleReview', () => {
  const fixedNow = new Date('2024-01-15T10:00:00Z');

  describe('new card behavior', () => {
    it('creates new card when null passed', () => {
      const card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      expect(card.reps).toBe(1);
    });

    it('new card starts in Learning state', () => {
      const card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      expect(card.state).toBe(State.Learning);
    });
  });

  describe('stability behavior', () => {
    it('CORRECT increases stability', () => {
      const card1 = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      const later = new Date(card1.due);
      const card2 = scheduleReview(card1, GradeStatus.CORRECT, later);
      expect(card2.stability).toBeGreaterThan(card1.stability);
    });

    it('INCORRECT resets to relearning', () => {
      // Build up a card with some stability
      let card = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      for (let i = 0; i < 3; i++) {
        card = scheduleReview(card, GradeStatus.CORRECT, new Date(card.due));
      }
      const beforeLapse = card.stability;

      // Now fail
      card = scheduleReview(card, GradeStatus.INCORRECT, new Date(card.due));
      expect(card.stability).toBeLessThan(beforeLapse);
      expect(card.state).toBe(State.Relearning);
    });
  });

  describe('counter behavior', () => {
    it('increments reps on each review', () => {
      const card1 = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      const card2 = scheduleReview(card1, GradeStatus.CORRECT, new Date(card1.due));
      expect(card2.reps).toBe(card1.reps + 1);
    });

    it('increments lapses on INCORRECT', () => {
      const card1 = scheduleReview(null, GradeStatus.CORRECT, fixedNow);
      const card2 = scheduleReview(card1, GradeStatus.INCORRECT, new Date(card1.due));
      expect(card2.lapses).toBe(card1.lapses + 1);
    });
  });
});
```

### Existing Tests to Delete

After FSRS migration complete:
- `lib/data/__tests__/srs.test.ts` — bucket algorithm tests no longer relevant

### Integration Tests (not blocking MVP)

Future: Test full flow through convexAdapter → api.reviews.record → getDue.

---

## Error Handling

**Validation Errors**:
- Invalid state string in database → parseState throws (developer error)
- Missing required fields → Convex validator rejects mutation

**Recovery**:
- Corrupted card data → scheduleReview(null, ...) treats as new card
- This is safe: user just sees the card as "new" again

---

## Performance Considerations

**FSRS Computation**: O(1), ~0.1ms per scheduling call. No performance concern.

**Database**:
- Same index strategy as bucket system
- Slightly more data per row (9 fields vs 7), negligible impact
- All queries remain sub-100ms

---

## Migration Plan

**Strategy: Clean slate**

1. Update schema (Convex handles schema evolution)
2. Deploy new code
3. Clear existing sentenceReviews data via Convex dashboard
4. All users start fresh with FSRS scheduling

**Rationale**: Users have minimal review history. Approximating FSRS state from bucket data adds complexity with no user benefit.

**Alternative Considered**: Migrate bucket → FSRS state
- Initial stability = BUCKET_INTERVALS[bucket] days
- Rejected: Bucket intervals don't map cleanly to FSRS stability model

---

## Alternative Architectures Considered

### Alternative A: Full Abstraction Layer
Create `ISRSAlgorithm` interface, implement both bucket and FSRS.

- **Pros**: Easy to swap algorithms, testable
- **Cons**: Over-engineering. We're shipping a product, not a platform.
- **Ousterhout**: Shallow module—interface complexity matches implementation
- **Verdict**: Rejected

### Alternative B: Keep Both Algorithms (Feature Flag)
Run both algorithms, A/B test.

- **Pros**: Data-driven decision
- **Cons**: Doubles complexity, user base too small for statistical power
- **Verdict**: Rejected—premature for current scale

### Alternative C: Store Only Derived Values
Only store `nextReviewAt`, recompute FSRS state on-the-fly.

- **Pros**: Simpler schema
- **Cons**: Loses optimization potential, can't tune per-user parameters
- **Verdict**: Rejected—store everything, decide later what to use

**Selected**: Thin wrapper with full state persistence
- **Justification**: Minimal code now, maximum flexibility later
- Deep modules with simple interfaces, minimal dependencies

---

## Acceptance Criteria

1. `pnpm test` passes with new FSRS tests
2. New card: first CORRECT → due in minutes (learning phase)
3. Graduated card: CORRECT → due in days, increasing over time
4. INCORRECT → card enters relearning, stability decreases
5. Dashboard stats still work (dueCount uses nextReviewAt, masteredCount uses stability threshold)
6. No changes to ReviewStep UI or grading flow
