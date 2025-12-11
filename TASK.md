# Full Corpus Generation & Content Selection

## Executive Summary

Generate the complete De Bello Gallico corpus (~393 chapters, ~3,000+ sentences). Enhance existing `DataAdapter.getContent()` to select appropriate content per user.

**Problem**: 9 sentences. Can't validate the product with 9 sentences.

**Solution**: One command generates full corpus. Adapter gets smarter. Ship in one weekend.

---

## Requirements (Simplified)

### Must Have
1. Full corpus generation (all 8 books, 393 chapters)
2. Content selection by difficulty + unseen status
3. Safe corpus sync (no orphaned reviews)
4. Manual level-up button

### Won't Have (Yet)
- Automatic level advancement
- Difficulty analysis/calibration phase
- Session composition config
- Narrative order preference (just sort by difficulty)
- Incremental pipeline processing

---

## Architecture Decision

### DO NOT create `lib/content/selection.ts`

Per architecture review: This would create a shallow pass-through module that breaks the existing adapter pattern.

### DO enhance `DataAdapter.getContent()`

Selection logic belongs in the adapter that already owns data access:

```typescript
// lib/data/convexAdapter.ts - ENHANCED getContent()
async getContent(userId: string): Promise<ContentSeed> {
  const progress = await this.getUserProgress(userId);
  const dueReviews = await this.getDueReviews(userId, 5);

  // Get candidate sentences at/below difficulty
  const candidates = await fetchQuery(
    api.sentences.getByDifficulty,
    { maxDifficulty: progress.maxDifficulty }
  );

  // Get seen sentence IDs (one query, O(1) Set lookup)
  const reviewIds = await fetchQuery(api.reviews.getSentenceIds, { userId });
  const seenIds = new Set(reviewIds);

  // Filter unseen, sort by difficulty (easiest first)
  const unseen = candidates
    .filter(s => !seenIds.has(s.sentenceId))
    .sort((a, b) => a.difficulty - b.difficulty)
    .slice(0, 2);

  return {
    review: dueReviews.slice(0, 5),
    reading: unseen.length > 0 ? mapToReading(unseen) : FALLBACK
  };
}
```

**Why**: Single responsibility, no new concepts, leverages indexed queries, minimal code.

---

## Implementation Phases (Revised)

### Phase 1: Corpus Generation (One Day)

**Goal**: Full corpus from all 8 books.

**Tasks**:
1. Add `process_all_books()` function to pipeline
2. Assign GLOBAL order across all sentences (not per-chapter)
3. Run overnight, validate output
4. Commit `corpus.json` to repo

```python
# process-corpus.py - NEW function
def process_all_books(force_fetch: bool, output_path: str) -> int:
    all_sentences = []
    global_order = 1

    for book in range(1, 9):
        chapter_count = get_chapter_count(book)
        for chapter in range(1, chapter_count + 1):
            log.info(f"Processing Book {book}, Chapter {chapter}")
            sentences = process_chapter_sentences(book, chapter, force_fetch)

            for sent in sentences:
                sent.order = global_order
                global_order += 1

            all_sentences.extend(sentences)

    export_corpus(all_sentences, output_path)
    log.info(f"Exported {len(all_sentences)} sentences")
    return EXIT_SUCCESS
```

**Data Integrity Fixes** (CRITICAL):
1. Log difficulty distribution after generation
2. Validate no duplicate IDs
3. Validate sequential ordering

**Acceptance**: 3,000+ sentences with global sequential order.

---

### Phase 2: Safe Corpus Sync (Half Day)

**Goal**: Sync to Convex without destroying user data.

**Critical Change**: Replace `replaceAll` DELETE+INSERT with UPSERT pattern.

```typescript
// convex/sentences.ts - SAFE sync mutation
export const syncCorpus = mutation({
  args: { sentences: v.array(SentenceSchema) },
  handler: async (ctx, args) => {
    // 1. Check for orphans BEFORE any changes
    const incomingIds = new Set(args.sentences.map(s => s.sentenceId));
    const allReviews = await ctx.db.query("sentenceReviews").collect();
    const orphaned = allReviews.filter(r => !incomingIds.has(r.sentenceId));

    if (orphaned.length > 0) {
      const affected = new Set(orphaned.map(r => r.userId));
      throw new ConvexError(
        `Would orphan ${orphaned.length} reviews for ${affected.size} users`
      );
    }

    // 2. Upsert each sentence (update if exists, insert if new)
    for (const sentence of args.sentences) {
      const existing = await ctx.db
        .query("sentences")
        .withIndex("by_sentence_id", q => q.eq("sentenceId", sentence.sentenceId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, sentence);
      } else {
        await ctx.db.insert("sentences", sentence);
      }
    }

    // 3. Delete stale sentences (not in incoming, no reviews)
    const existing = await ctx.db.query("sentences").collect();
    for (const doc of existing) {
      if (!incomingIds.has(doc.sentenceId)) {
        await ctx.db.delete(doc._id);
      }
    }

    return { synced: args.sentences.length };
  }
});
```

**Additional Safety**:
```bash
# corpus-sync.ts - Add backup before sync
pnpm corpus:backup > backups/$(date +%Y%m%d).json
pnpm corpus:sync
```

**Acceptance**: Sync completes without orphaning existing reviews.

---

### Phase 3: Intelligent Selection (Half Day)

**Goal**: `getContent()` returns appropriate content per user.

**Tasks**:
1. Add `reviews.getSentenceIds` query (efficient ID-only fetch)
2. Enhance `ConvexAdapter.getContent()` per architecture above
3. Update `memoryAdapter` for dev parity
4. Set `DEFAULT_MAX_DIFFICULTY = 10` (start users low)
5. Test: new user sees easiest sentences

```typescript
// convex/reviews.ts - NEW efficient query
export const getSentenceIds = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const reviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", q => q.eq("userId", userId))
      .collect();
    return reviews.map(r => r.sentenceId);
  }
});
```

**Acceptance**: Users see content at/below their `maxDifficulty`, never repeats unseen.

---

### Phase 4: Manual Level-Up (1 Hour)

**Goal**: User can progress when ready.

**Implementation**:
```typescript
// Dashboard button
<Button onClick={() => incrementMaxDifficulty(5)}>
  Ready for harder content
</Button>

// convex/userProgress.ts
export const incrementDifficulty = mutation({
  args: { userId: v.string(), increment: v.number() },
  handler: async (ctx, { userId, increment }) => {
    const progress = await getProgress(userId);
    await ctx.db.patch(progress._id, {
      maxDifficulty: Math.min(100, progress.maxDifficulty + increment)
    });
  }
});
```

**No automatic advancement**. Users know when they're ready better than algorithms.

**Acceptance**: Clicking button unlocks harder content.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Selection module | NO - enhance adapter | Preserves existing pattern, no shallow wrappers |
| Difficulty analysis | NO - defer | Ship first, calibrate from real user data |
| Automatic level-up | NO - manual button | Users know their readiness |
| Narrative order | NO - difficulty order | Simpler, can add later if users want it |
| Incremental pipeline | NO - one command | Run once, corpus is static |
| Orphan protection | YES - critical | Prevents data loss on sync |

---

## Data Integrity Checklist

- [ ] `syncCorpus` checks for orphaned reviews before changes
- [ ] Uses upsert pattern (patch existing, insert new)
- [ ] Global order assigned across all chapters (no collisions)
- [ ] Backup exported before sync
- [ ] Low-confidence alignments logged (fix manually later)

---

## Test Scenarios

### Corpus Generation
- [ ] All 8 books produce ~3,000+ sentences
- [ ] Order values are sequential 1 to N (no gaps)
- [ ] Re-running produces identical output (idempotent)

### Safe Sync
- [ ] Sync with existing reviews succeeds
- [ ] Sync that would orphan reviews FAILS with clear error
- [ ] Backup/restore workflow tested

### Content Selection
- [ ] New user (maxDifficulty=10) gets easiest sentences
- [ ] User with reviews sees due reviews + unseen content
- [ ] Completed sentence doesn't repeat next session

### Level-Up
- [ ] Button increments maxDifficulty
- [ ] New content appears after level-up

---

## File Changes

```
MODIFY:
  scripts/process-corpus.py    # Add process_all_books()
  scripts/corpus-sync.ts       # Add backup, use new mutation
  convex/sentences.ts          # Replace replaceAll with syncCorpus
  convex/reviews.ts            # Add getSentenceIds query
  lib/data/convexAdapter.ts    # Enhance getContent()
  lib/data/adapter.ts          # Update memoryAdapter

DO NOT CREATE:
  lib/content/selection.ts     # Architecture violation
  lib/content/corpus.ts        # Unnecessary
```

---

## Timeline

| Phase | Effort | When |
|-------|--------|------|
| 1. Corpus Generation | 4-6 hours | Day 1 |
| 2. Safe Sync | 2-3 hours | Day 1 |
| 3. Intelligent Selection | 2-3 hours | Day 2 |
| 4. Manual Level-Up | 1 hour | Day 2 |
| **Total** | **~10 hours** | **One weekend** |

---

## What Makes This Insanely Great

Not the algorithm. Not the architecture.

The moment: User translates a sentence. Gets feedback. Sentence fades. New sentence appears - slightly harder but still achievable. User thinks "I can do this."

**The corpus is fuel. Selection is the engine. The product is that moment.**

Ship it. Learn. Iterate.
