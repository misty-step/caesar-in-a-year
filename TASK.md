# Convex Persistence Layer

## Executive Summary

Replace in-memory data stores with Convex persistence so user learning progress survives server restarts. Focus on spaced repetition data (sentence reviews with simple bucket intervals) and gamification stats (streak, XP). Sessions remain ephemeral. Convex is primary content source.

**Success criteria:** User closes browser, returns next day, sees streak intact and correct sentences due for review.

## User Context

**Who:** Solo founder learning Latin via daily sessions.

**Problems solved:**
- Progress lost on every deploy/restart
- No spaced repetition (can't track which sentences are due)
- Gamification stats reset constantly

**Measurable benefit:** Uninterrupted learning continuity.

## Requirements

### Functional

1. **User progress persists** - streak, XP survive restarts
2. **Sentence review state persists** - per-sentence SRS data (bucket, nextReviewAt)
3. **Due reviews queryable** - get sentences where nextReviewAt <= now
4. **Content from Convex** - sentences table as primary source

### Non-Functional

- **Latency:** < 100ms (Convex default)
- **Consistency:** User sees own writes immediately
- **Integrity:** No orphaned records, no duplicates

## Architecture Decision

### Selected Approach: Minimal Persistence

Persist **two tables only**: `userProgress` and `sentenceReviews`. No attempt history (defer to Phase 3 when analytics needed). Sessions stay ephemeral.

**Rationale:**
- Simplest path to core value (learning continuity)
- Attempt history has no user-facing benefit yet
- Matches Jobs principle: "What's the MINIMUM to make user trust the app remembers them?"

### Schema Design (Simplified)

```typescript
// convex/schema.ts

// Existing - keep as-is
sentences: defineTable({
  sentenceId: v.string(),
  latin: v.string(),
  referenceTranslation: v.string(),
  difficulty: v.number(),
  order: v.number(),
})
  .index("by_sentence_id", ["sentenceId"])
  .index("by_difficulty", ["difficulty"]),

// User-level stats
userProgress: defineTable({
  userId: v.string(),              // Clerk subject
  streak: v.number(),              // Consecutive days
  totalXp: v.number(),             // Gamification
  maxDifficulty: v.number(),       // Content gating (replaces "unlockedPhase")
  lastSessionAt: v.number(),       // Unix ms - for streak calculation
})
  .index("by_user", ["userId"]),

// Per-sentence SRS state (simple buckets, not SM-2)
sentenceReviews: defineTable({
  userId: v.string(),
  sentenceId: v.string(),
  bucket: v.number(),              // 0-4: intervals [1, 3, 7, 14, 30] days
  nextReviewAt: v.number(),        // Unix ms - when due
  lastReviewedAt: v.number(),      // Unix ms
  timesCorrect: v.number(),
  timesIncorrect: v.number(),
})
  .index("by_user_due", ["userId", "nextReviewAt"])
  .index("by_user_sentence", ["userId", "sentenceId"]),
```

### SRS Algorithm (Simple Buckets)

```typescript
const BUCKET_INTERVALS = [1, 3, 7, 14, 30]; // Days
const MAX_BUCKET = BUCKET_INTERVALS.length - 1;

function updateReview(review: SentenceReview, result: GradingResult): SentenceReview {
  const correct = result.status === 'CORRECT';
  const partial = result.status === 'PARTIAL';
  
  // CORRECT: advance bucket, PARTIAL: stay, INCORRECT: drop
  const newBucket = correct
    ? Math.min(review.bucket + 1, MAX_BUCKET)
    : partial
      ? review.bucket
      : Math.max(review.bucket - 1, 0);
  
  const intervalDays = BUCKET_INTERVALS[newBucket];
  const nextReviewAt = Date.now() + intervalDays * 24 * 60 * 60 * 1000;

  return {
    ...review,
    bucket: newBucket,
    nextReviewAt,
    lastReviewedAt: Date.now(),
    timesCorrect: review.timesCorrect + (correct ? 1 : 0),
    timesIncorrect: review.timesIncorrect + (result.status === 'INCORRECT' ? 1 : 0),
  };
}
```

**Why buckets over SM-2:**
- Ships in days, not weeks
- User can't tell the difference
- Backlog already plans FSRS upgrade (Phase 3)

### DataAdapter Interface (Deep Module)

```typescript
// lib/data/types.ts

export interface ReviewSentence extends Sentence {
  reviewCount: number;  // timesCorrect + timesIncorrect
}

export interface ReviewStats {
  dueCount: number;
  totalReviewed: number;
  masteredCount: number;  // bucket >= 4
}

export interface DataAdapter {
  // Existing methods (unchanged)
  getUserProgress(userId: string): Promise<UserProgress | null>;
  upsertUserProgress(progress: UserProgress): Promise<void>;
  getContent(): Promise<ContentSeed>;
  createSession(userId: string, items: Session['items']): Promise<Session>;
  getSession(sessionId: string, userId: string): Promise<Session | null>;
  advanceSession(params: AdvanceSessionParams): Promise<Session>;
  recordAttempt(attempt: Attempt): Promise<void>;  // Kept for session flow, but not persisted

  // NEW: Spaced repetition
  getDueReviews(userId: string, limit?: number): Promise<ReviewSentence[]>;
  getReviewStats(userId: string): Promise<ReviewStats>;
  recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void>;
}
```

**Key design decisions:**
- `recordReview` takes `GradingResult`, not opaque quality number
- `getDueReviews` returns `ReviewSentence` (hides bucket/interval internals)
- `getReviewStats` for dashboard (avoid overfetching)
- `recordAttempt` stays for session flow but ConvexAdapter can no-op it

## Data Integrity Requirements

### P0: Must Have Before Launch

1. **Unique constraint enforcement** (userId + sentenceId)
   ```typescript
   // In recordReview mutation
   const existing = await ctx.db
     .query("sentenceReviews")
     .withIndex("by_user_sentence", q => q.eq("userId", userId).eq("sentenceId", sentenceId))
     .unique();
   
   if (existing) {
     await ctx.db.patch(existing._id, updates);
   } else {
     await ctx.db.insert("sentenceReviews", newReview);
   }
   ```

2. **Foreign key validation** (sentenceId exists)
   ```typescript
   const sentence = await ctx.db
     .query("sentences")
     .withIndex("by_sentence_id", q => q.eq("sentenceId", sentenceId))
     .first();
   
   if (!sentence) {
     throw new ConvexError(`Sentence ${sentenceId} not found`);
   }
   ```

3. **GDPR deletion** - User data erasure on account deletion
   ```typescript
   // convex/users.ts
   export const deleteUserData = mutation({
     args: { userId: v.string() },
     handler: async (ctx, { userId }) => {
       // Delete sentenceReviews
       const reviews = await ctx.db
         .query("sentenceReviews")
         .withIndex("by_user_sentence", q => q.eq("userId", userId))
         .collect();
       for (const r of reviews) await ctx.db.delete(r._id);
       
       // Delete userProgress
       const progress = await ctx.db
         .query("userProgress")
         .withIndex("by_user", q => q.eq("userId", userId))
         .first();
       if (progress) await ctx.db.delete(progress._id);
     }
   });
   ```

4. **Timestamp consistency** - All timestamps as Unix ms (numbers), never ISO strings

### P1: Should Have

5. **Admin domain check** - `@mistystep.io` (not .com)
6. **Bucket overflow cap** - Max 30 days, never exceeds

## Implementation Phases

### Phase 1: Core Persistence (MVP)

1. Add Convex auth.config.js for Clerk
2. Extend schema.ts with userProgress, sentenceReviews
3. Implement Convex functions with integrity checks
4. Create ConvexAdapter implementing DataAdapter
5. Swap createDataAdapter() to return ConvexAdapter
6. Add GDPR deletion endpoint

**Acceptance:** User progress persists across deploys. No orphans, no duplicates.

### Phase 2: Dashboard Integration

1. Show due reviews count on dashboard
2. Pull due reviews for session creation
3. Call recordReview after grading
4. Streak calculation (lastSessionAt comparison)

**Acceptance:** Sentences resurface at correct intervals.

### Phase 3: Analytics & FSRS (Future)

1. Add attempts table for history
2. Upgrade to FSRS algorithm (ts-fsrs)
3. Analytics dashboard

---

## Files to Create/Modify

```
convex/
  auth.config.js         # NEW: Clerk integration
  schema.ts              # MODIFY: Add 2 tables
  userProgress.ts        # NEW: get, upsert
  reviews.ts             # NEW: getDue, record, stats
  users.ts               # NEW: GDPR deletion

lib/data/
  types.ts               # MODIFY: Add ReviewSentence, ReviewStats, new methods
  convexAdapter.ts       # NEW: DataAdapter implementation
  adapter.ts             # MODIFY: Factory returns ConvexAdapter
```

## Key Decisions

| Decision | Why |
|----------|-----|
| No attempts table (Phase 1) | No user benefit yet; adds complexity |
| Buckets over SM-2 | Ships faster; FSRS planned for Phase 3 anyway |
| `GradingResult` not `quality: number` | Type-safe; hides algorithm internals |
| `ReviewSentence` not `SentenceReview` | Deep module; callers don't see bucket/interval |
| Unix ms timestamps everywhere | Consistency; easy comparison |
| GDPR deletion from Day 1 | Legal requirement; easy to add now |
