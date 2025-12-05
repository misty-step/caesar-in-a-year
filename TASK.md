# FSRS Integration

## Executive Summary

Replace the simple bucket-based SRS algorithm with ts-fsrs for scientifically-backed spaced repetition scheduling. The current system uses fixed intervals [1, 3, 7, 14, 30] days; FSRS dynamically calculates optimal intervals based on memory stability and retrievability models.

**User value**: Better retention with fewer reviews. FSRS adapts to individual learning patterns rather than fixed progressions.

**Success criteria**: Review intervals grow with correct answers, shrink with incorrect.

---

## Requirements

### Functional
1. Replace bucket algorithm with FSRS scheduling
2. Map grading outcomes to FSRS ratings: INCORRECT→Again, PARTIAL→Hard, CORRECT→Good
3. Query due reviews by scheduled date

### Non-Functional
- No user-facing changes (grading UI unchanged)
- Sub-100ms scheduling calculations (FSRS is O(1))

---

## Architecture

### Selected Approach: Thin Wrapper

Minimal abstraction over ts-fsrs. The library is well-designed; we don't need to hide it.

```
gradeTranslation() → GradingResult
                          ↓
              mapGradeToRating(status)
                          ↓
                 fsrs.repeat(card, now)
                          ↓
              schedulingCards[rating].card
                          ↓
                 Convex mutation (persist)
```

### Rating Mapping

```typescript
function mapGradeToRating(status: GradeStatus): Rating {
  switch (status) {
    case GradeStatus.INCORRECT: return Rating.Again;  // Forgot → relearn
    case GradeStatus.PARTIAL:   return Rating.Hard;   // Struggled → slow advance
    case GradeStatus.CORRECT:   return Rating.Good;   // Recalled → normal advance
  }
}
```

We never use `Rating.Easy` — quiz-based grading has no "effortless recall" signal.

---

## Schema Migration

### Current Schema
```typescript
sentenceReviews: {
  userId, sentenceId,
  bucket: number,           // 0-4
  nextReviewAt: number,     // Unix ms
  lastReviewedAt: number,
  timesCorrect: number,
  timesIncorrect: number,
}
```

### New Schema
```typescript
sentenceReviews: {
  userId, sentenceId,

  // FSRS card state (stored directly, no conversion layer)
  state: "new" | "learning" | "review" | "relearning",
  stability: number,        // Memory stability (days)
  difficulty: number,       // Card difficulty (0-1)
  elapsedDays: number,      // Days since last review
  scheduledDays: number,    // Days until next review
  reps: number,             // Total review count
  lapses: number,           // Times forgotten (Again count)
  lastReview: number,       // Unix ms (optional for new cards)

  // Indexed for due queries
  nextReviewAt: number,     // Unix ms
}
```

### Migration Strategy

**True fresh start**: Reset all existing reviews to `state = "new"`. Users have few reviews currently; clean slate is simpler than approximating FSRS state from bucket history.

---

## Implementation

### Files to Change

```
lib/srs/
  fsrs.ts              # NEW: ts-fsrs wrapper (rating map only)

lib/data/
  srs.ts               # DELETE: old bucket algorithm
  convexAdapter.ts     # UPDATE: use fsrs.ts

convex/
  schema.ts            # UPDATE: new sentenceReviews fields
  reviews.ts           # UPDATE: mutations for new schema
```

### Core Module: `lib/srs/fsrs.ts`

```typescript
import { fsrs, createEmptyCard, Rating, type Card } from 'ts-fsrs';
import { GradeStatus } from '@/types';

// 90% retention target - FSRS default, tune after collecting user data
const RETENTION_TARGET = 0.90;
const f = fsrs({ requestRetention: RETENTION_TARGET });

export { Rating, type Card, createEmptyCard };

export function mapGradeToRating(status: GradeStatus): Rating {
  switch (status) {
    case GradeStatus.INCORRECT: return Rating.Again;
    case GradeStatus.PARTIAL:   return Rating.Hard;
    case GradeStatus.CORRECT:   return Rating.Good;
  }
}

export function scheduleReview(card: Card | null, status: GradeStatus, now = new Date()): Card {
  const currentCard = card ?? createEmptyCard(now);
  const rating = mapGradeToRating(status);
  const scheduling = f.repeat(currentCard, now);
  return scheduling[rating].card;
}
```

---

## Test Scenarios

### Unit Tests (`lib/srs/__tests__/fsrs.test.ts`)
- [ ] CORRECT → Good rating, stability increases
- [ ] PARTIAL → Hard rating, stability increases slowly
- [ ] INCORRECT → Again rating, card enters relearning
- [ ] New card starts in Learning state
- [ ] Card graduates to Review after learning steps

### Integration Tests
- [ ] Full flow: grade → schedule → persist → query due
- [ ] Stats: dueCount calculations still work

---

## Acceptance Criteria

1. `pnpm test` passes with new FSRS tests
2. Review intervals grow with correct answers
3. Review intervals shrink/reset with incorrect answers
4. Dashboard stats (due count) still work
