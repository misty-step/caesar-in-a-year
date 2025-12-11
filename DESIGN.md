# Full Corpus Content Selection — Architecture Design

## Architecture Overview

**Selected Approach**: Adapter-based content selection with safe corpus sync

**Rationale**: Enhancing the existing `DataAdapter.getContent()` preserves the adapter pattern, avoids shallow pass-through modules, and keeps selection logic co-located with data access. The upsert-based sync protects user data while enabling corpus evolution.

**Core Modules** (modifications only, no new modules):

- `scripts/process-corpus.py`: Full corpus generation (already has `--all`, validate output)
- `scripts/corpus-sync.ts`: Safe sync with backup + orphan protection
- `convex/sentences.ts`: Replace destructive `replaceAll` with `syncCorpus` mutation
- `convex/reviews.ts`: Add `getSentenceIds` query for efficient lookup
- `lib/data/convexAdapter.ts`: Enhance `getContent()` with difficulty + unseen filtering
- `convex/userProgress.ts`: Add `incrementDifficulty` mutation

**Data Flow**:
```
User Request → getContent(userId)
    → getDueReviews(userId, 5)           # FSRS-scheduled reviews
    → getByDifficulty(maxDifficulty)     # Candidate sentences
    → getSentenceIds(userId)             # Already-seen IDs (O(1) Set lookup)
    → Filter unseen, sort by difficulty
    → Return ContentSeed { review, reading }
```

**Key Design Decisions**:

1. **No new selection module**: Selection logic in adapter, not `lib/content/selection.ts`
2. **Global sequential ordering**: Sentences ordered 1..N across all 8 books (not per-chapter)
3. **Upsert pattern**: Patch existing sentences, insert new, delete stale (if no reviews)
4. **Orphan protection**: Sync fails loudly if it would orphan existing reviews
5. **DEFAULT_MAX_DIFFICULTY = 10**: New users start with easiest content

---

## Phase 1: Corpus Generation

### Module: scripts/process-corpus.py

**Responsibility**: Generate full De Bello Gallico corpus from Perseus (Latin) + MIT Classics (English).

**Current State**: `process_all_books()` already implemented and functional. Runs with `pnpm corpus:process-all`.

**Required Changes**: None for generation. Add post-generation validation.

**Validation Checklist** (run after generation):

```pseudocode
function validate_corpus(corpus_path):
    1. Load corpus.json
    2. Verify sentence_count matches array length
    3. Check no duplicate IDs:
       ids = [s.id for s in sentences]
       assert len(ids) == len(set(ids))
    4. Verify order is sequential 1..N with no gaps:
       orders = [s.order for s in sentences]
       assert orders == list(range(1, len(orders) + 1))
    5. Log difficulty distribution:
       buckets = Counter(s.difficulty // 10 * 10 for s in sentences)
       for bucket in sorted(buckets): log(f"{bucket}-{bucket+9}: {buckets[bucket]}")
    6. Warn on low alignment confidence (<0.8)
```

**Acceptance Criteria**:
- [ ] ~3,000+ sentences generated
- [ ] Order values: sequential 1 to N
- [ ] No duplicate IDs
- [ ] Difficulty distribution logged
- [ ] Low-confidence alignments flagged

---

## Phase 2: Safe Corpus Sync

### Module: convex/sentences.ts

**Responsibility**: Safely sync corpus to Convex without destroying user review data.

**Public Interface**:

```typescript
// NEW mutation replacing replaceAll
export const syncCorpus = mutation({
  args: {
    sentences: v.array(v.object({
      sentenceId: v.string(),
      latin: v.string(),
      referenceTranslation: v.string(),
      difficulty: v.number(),
      order: v.number(),
      alignmentConfidence: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => { ... }
});
```

**Internal Implementation** (pseudocode):

```pseudocode
function syncCorpus(sentences):
    # 1. Build incoming ID set
    incoming_ids = Set(s.sentenceId for s in sentences)

    # 2. Check for orphaned reviews BEFORE any changes
    all_reviews = db.query("sentenceReviews").collect()
    orphaned = [r for r in all_reviews if r.sentenceId not in incoming_ids]

    if orphaned:
        affected_users = Set(r.userId for r in orphaned)
        throw ConvexError(
            f"Would orphan {len(orphaned)} reviews for {len(affected_users)} users. "
            f"Sentence IDs: {[r.sentenceId for r in orphaned[:5]]}..."
        )

    # 3. Upsert each sentence
    for sentence in sentences:
        existing = db.query("sentences")
            .withIndex("by_sentence_id", q => q.eq("sentenceId", sentence.sentenceId))
            .unique()

        if existing:
            db.patch(existing._id, {
                latin: sentence.latin,
                referenceTranslation: sentence.referenceTranslation,
                difficulty: sentence.difficulty,
                order: sentence.order,
                alignmentConfidence: sentence.alignmentConfidence,
            })
        else:
            db.insert("sentences", sentence)

    # 4. Delete stale sentences (not in incoming, guaranteed no reviews from step 2)
    existing_sentences = db.query("sentences").collect()
    for doc in existing_sentences:
        if doc.sentenceId not in incoming_ids:
            db.delete(doc._id)

    return { synced: len(sentences), deleted: stale_count }
```

**Error Handling**:
- Orphan detection → ConvexError with specific sentence IDs and user count
- Auth failure → ConvexError (admin only, existing pattern)

### Module: scripts/corpus-sync.ts

**Responsibility**: Sync local corpus.json to Convex with backup.

**Required Changes**:

```typescript
// Before sync, export backup
async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `backups/corpus-${timestamp}.json`;
  // Export current Convex sentences to backup file
  const client = new ConvexHttpClient(process.env.CONVEX_URL!);
  const sentences = await client.query("sentences:getAll" as never);
  await fs.writeFile(backupPath, JSON.stringify({ sentences }, null, 2));
  console.log(`✓ Backup created: ${backupPath}`);
  return backupPath;
}

// Main sync function update
async function syncCorpus(filePath: string, dryRun: boolean): Promise<void> {
  // ... existing validation ...

  if (!dryRun) {
    await createBackup();  // NEW: backup before sync

    // Call new syncCorpus mutation instead of replaceAll
    const result = await client.mutation(
      "sentences:syncCorpus" as never,
      { sentences: transformedSentences }
    );
    console.log(`✓ Synced: ${result.synced}, Deleted: ${result.deleted}`);
  }
}
```

**Acceptance Criteria**:
- [ ] Backup created before sync
- [ ] Sync with existing reviews succeeds
- [ ] Sync that would orphan reviews FAILS with clear error message
- [ ] Stale sentences (no reviews) are cleaned up

---

## Phase 3: Intelligent Content Selection

### Module: convex/reviews.ts

**Responsibility**: Add efficient query for user's seen sentence IDs.

**New Query**:

```typescript
export const getSentenceIds = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, userId);

    const reviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) => q.eq("userId", userId))
      .collect();

    return reviews.map((r) => r.sentenceId);
  },
});
```

**Why this design**:
- Returns only IDs (minimal data transfer)
- Uses existing `by_user_sentence` index (no schema change)
- O(n) query once, then O(1) Set lookup in adapter

### Module: lib/data/convexAdapter.ts

**Responsibility**: Select appropriate content per user difficulty + unseen status.

**Enhanced getContent()** (pseudocode):

```pseudocode
const DEFAULT_MAX_DIFFICULTY = 10;  # New users start easy

async function getContent(userId: string): Promise<ContentSeed> {
    # 1. Get user progress (or default)
    progress = await getUserProgress(userId)
    maxDifficulty = progress?.maxDifficulty ?? DEFAULT_MAX_DIFFICULTY

    # 2. Get due reviews (FSRS-scheduled)
    dueReviews = await getDueReviews(userId, 5)

    # 3. Get candidate sentences at/below difficulty
    candidates = await fetchQuery(
        api.sentences.getByDifficulty,
        { maxDifficulty }
    )

    # 4. Get seen sentence IDs (efficient: one query, returns IDs only)
    seenIds = new Set(
        await fetchQuery(api.reviews.getSentenceIds, { userId })
    )

    # 5. Filter unseen, sort by difficulty (easiest first), take 2
    unseen = candidates
        .filter(s => !seenIds.has(s.sentenceId))
        .sort((a, b) => a.difficulty - b.difficulty)
        .slice(0, 2)

    # 6. Build response
    if unseen.length > 0:
        return {
            review: dueReviews.slice(0, 5),
            reading: mapToReading(unseen)  # Convert sentences to ReadingPassage
        }
    else:
        # User has seen everything at their level
        return {
            review: dueReviews.slice(0, 5),
            reading: FALLBACK_CONTENT.reading  # Static fallback
        }
```

**Helper: mapToReading()**:

```typescript
function mapToReading(sentences: SentenceDoc[]): ReadingPassage {
  // Build reading passage from 1-2 sentences
  const first = sentences[0];
  return {
    id: `reading-${first.sentenceId}`,
    title: `De Bello Gallico ${first.sentenceId.split('.').slice(1, 3).join('.')}`,
    latinText: sentences.map((s) => s.latin),
    glossary: {}, // Phase 2: could add vocabulary from lemmas
    gistQuestion: 'Translate this passage into natural English.',
    referenceGist: sentences.map((s) => s.referenceTranslation).join(' '),
  };
}
```

**Interface Changes**:

```typescript
// Update DataAdapter interface (lib/data/types.ts)
export interface DataAdapter {
  // ... existing methods ...
  getContent(userId: string): Promise<ContentSeed>;  // ADD userId parameter
}
```

**Breaking Change Handling**:
- `getContent()` now requires `userId` parameter
- Update all call sites (session builder, API routes)
- Memory adapter gets parallel implementation for dev parity

### Module: lib/data/adapter.ts (memoryAdapter)

**Update for dev parity**:

```typescript
const memoryAdapter: DataAdapter = {
  // ... existing methods ...

  async getContent(userId: string): Promise<ContentSeed> {
    // Simplified: return first 3 sentences from corpus for local dev
    // No filtering by difficulty/seen (that's Convex's job)
    const corpus = await loadCorpusSentences();
    if (corpus.length === 0) return staticContent;

    return {
      review: corpus.slice(0, 3),
      reading: DAILY_READING,
    };
  },
};
```

**Acceptance Criteria**:
- [ ] New user (maxDifficulty=10) sees only difficulty ≤ 10 sentences
- [ ] User with reviews sees due reviews + unseen content
- [ ] Completed sentence doesn't appear as "new" next session
- [ ] Fallback content shown when user exhausts current level

---

## Phase 4: Manual Level-Up

### Module: convex/userProgress.ts

**New Mutation**:

```typescript
export const incrementDifficulty = mutation({
  args: {
    userId: v.string(),
    increment: v.number(),  // Default: 5
  },
  handler: async (ctx, { userId, increment }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== userId) {
      throw new ConvexError("Cannot modify another user's progress");
    }

    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existing) {
      // Create with bumped difficulty
      await ctx.db.insert("userProgress", {
        userId,
        streak: 0,
        totalXp: 0,
        maxDifficulty: Math.min(100, 10 + increment),  // Start at 10, bump
        lastSessionAt: 0,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      maxDifficulty: Math.min(100, existing.maxDifficulty + increment),
    });
  },
});
```

### UI Component: Dashboard Level-Up Button

**Location**: Enhance existing Dashboard component

**Implementation** (pseudocode):

```tsx
// In Dashboard component
const { mutate: bumpDifficulty } = useMutation(api.userProgress.incrementDifficulty);

<Button
  onClick={() => bumpDifficulty({ userId, increment: 5 })}
  disabled={progress.maxDifficulty >= 100}
>
  Ready for harder content (+5 difficulty)
</Button>

{progress.maxDifficulty >= 100 && (
  <p className="text-sm text-muted">You've unlocked all content!</p>
)}
```

**Acceptance Criteria**:
- [ ] Button increments maxDifficulty by 5
- [ ] Capped at 100 (max difficulty)
- [ ] New content appears immediately after level-up
- [ ] Button disabled when maxDifficulty = 100

---

## File Organization

```
MODIFY:
  scripts/process-corpus.py     # Validation logging (already has --all)
  scripts/corpus-sync.ts        # Backup before sync, use syncCorpus mutation
  convex/sentences.ts           # Add syncCorpus mutation (keep replaceAll for now)
  convex/reviews.ts             # Add getSentenceIds query
  convex/userProgress.ts        # Add incrementDifficulty mutation
  lib/data/types.ts             # Update getContent signature (add userId)
  lib/data/convexAdapter.ts     # Enhance getContent() with selection logic
  lib/data/adapter.ts           # Update memoryAdapter for interface parity
  app/(app)/dashboard/page.tsx  # Add level-up button (if exists)

DO NOT CREATE:
  lib/content/selection.ts      # Architecture violation
  lib/content/corpus.ts         # Unnecessary abstraction
```

---

## Data Structures

### Corpus JSON Schema (content/corpus.json)

```typescript
interface CorpusFile {
  sentences: Array<{
    id: string;                    // "bg.1.1.1" (book.chapter.sentence)
    latin: string;
    referenceTranslation: string;
    difficulty: number;            // 1-100
    order: number;                 // Global sequential: 1 to ~3000
    alignmentConfidence: number;   // 0-1
  }>;
  metadata: {
    version: string;
    generated_at: string;          // ISO timestamp
    sentence_count: number;
  };
}
```

### Convex Schema (unchanged)

```typescript
sentences: {
  sentenceId: string;              // "bg.1.1.1"
  latin: string;
  referenceTranslation: string;
  difficulty: number;              // 1-100
  order: number;                   // Global reading sequence
  alignmentConfidence?: number;    // 0-1
}

// Indexes:
// - by_sentence_id: [sentenceId] (unique lookup)
// - by_difficulty: [difficulty] (range queries)
// - by_order: [order] (reading sequence)
```

---

## Error Handling Strategy

### Sync Errors

| Error | Response | User Action |
|-------|----------|-------------|
| Orphan detection | ConvexError with IDs | Review sentence mapping, update corpus |
| Auth failure | ConvexError | Re-authenticate |
| Network error | Retry with backoff | Wait, retry |

### Selection Errors

| Error | Response | User Experience |
|-------|----------|-----------------|
| No sentences at difficulty | Return fallback | Show "no new content" message |
| User exhausted level | Return due reviews only | Prompt level-up |
| Query timeout | Log, return fallback | Degraded but functional |

---

## Testing Strategy

### Unit Tests

**convex/sentences.ts (syncCorpus)**:
- Sync with empty database → inserts all
- Sync with existing sentences → updates changed, keeps unchanged
- Sync with reviews present → succeeds (no orphans)
- Sync that would orphan → throws ConvexError

**lib/data/convexAdapter.ts (getContent)**:
- New user → returns easiest sentences (difficulty ≤ 10)
- User with reviews → excludes seen sentences
- User with maxDifficulty=50 → returns sentences ≤ 50
- User exhausted level → returns fallback

**convex/userProgress.ts (incrementDifficulty)**:
- Increments by specified amount
- Caps at 100
- Creates progress if missing

### Integration Tests

**Full sync flow**:
1. Generate corpus (mock or small test set)
2. Sync to test Convex instance
3. Verify sentence count
4. Re-sync with changes → verify upsert behavior

**Content selection flow**:
1. Create test user with maxDifficulty=10
2. Call getContent → verify only easy sentences
3. Record review for one sentence
4. Call getContent → verify that sentence excluded
5. Increment difficulty
6. Call getContent → verify harder sentences included

---

## Performance Considerations

### Corpus Sync

- **Batch size**: ~3,000 sentences in single mutation
- **Convex limits**: 8MB mutation payload (well under with ~3K sentences)
- **Time**: ~10-30s for full sync (acceptable for admin operation)

### Content Selection

- **getByDifficulty**: Uses `by_difficulty` index → O(log n) + linear scan of results
- **getSentenceIds**: Uses `by_user_sentence` index → O(n) where n = user's reviews
- **Set lookup**: O(1) per candidate sentence
- **Expected latency**: <200ms for typical user (< 100 reviews)

### Scaling Considerations

- **Heavy users (1000+ reviews)**: getSentenceIds returns 1000+ IDs
  - Acceptable: IDs are small (~20 bytes each), total payload ~20KB
  - If problematic later: add server-side filtering in Convex function
- **Full corpus queries**: getByDifficulty may return 1000+ sentences at high difficulty
  - Acceptable for now: filter client-side
  - Future optimization: add `.take(100)` and sort in query

---

## Alternatives Considered

### Alternative A: Separate Selection Module

**Structure**: `lib/content/selection.ts` with `selectContent(userId)` function

**Pros**:
- Explicit module boundary
- Could add caching layer

**Cons**:
- Shallow pass-through (calls adapter methods, returns adapter types)
- Breaks established adapter pattern
- Extra abstraction without new functionality

**Verdict**: Rejected — violates Ousterhout's "deep modules" principle

### Alternative B: Server-Side Filtering in Convex

**Structure**: Move all selection logic into Convex query

```typescript
export const getContentForUser = query({
  args: { userId: v.string(), maxDifficulty: v.number() },
  handler: async (ctx, args) => {
    // All filtering in Convex
  }
});
```

**Pros**:
- Single round trip
- Database-side filtering (potentially faster)

**Cons**:
- Requires new query (schema change)
- Mixes concerns (FSRS logic + content selection)
- Harder to test in isolation

**Verdict**: Rejected — prefer keeping FSRS logic in adapter layer

### Alternative C: Pre-computed Content Queues

**Structure**: Nightly job pre-computes next N sentences per user

**Pros**:
- Fast reads (pre-computed)
- Could optimize for narrative ordering

**Cons**:
- Stale data (user reviews during day not reflected)
- Complex infrastructure (cron jobs, cache invalidation)
- Premature optimization

**Verdict**: Rejected — add complexity only if runtime selection proves slow

---

## Implementation Sequence

```
Phase 1: Corpus Generation (~4-6 hours)
├── Run `pnpm corpus:process-all`
├── Validate output (IDs, ordering, distribution)
├── Commit corpus.json
└── Done: ~3,000 sentences with global order

Phase 2: Safe Sync (~2-3 hours)
├── Add syncCorpus mutation to convex/sentences.ts
├── Update corpus-sync.ts to use syncCorpus + backup
├── Test orphan protection
└── Done: Safe sync with data protection

Phase 3: Intelligent Selection (~2-3 hours)
├── Add getSentenceIds query to convex/reviews.ts
├── Enhance ConvexAdapter.getContent() with filtering
├── Update DataAdapter interface (add userId)
├── Update call sites
├── Test selection logic
└── Done: Users see appropriate content

Phase 4: Manual Level-Up (~1 hour)
├── Add incrementDifficulty mutation
├── Add dashboard button
└── Done: Users can progress
```

---

## What's NOT In Scope

| Feature | Reason |
|---------|--------|
| Automatic level advancement | Users know readiness better than algorithms |
| Narrative ordering preference | Difficulty ordering simpler; add later if requested |
| Vocabulary tracking | Level-based selection is sufficient for MVP |
| Incremental pipeline | One-time run; corpus is static |
| Difficulty calibration | Ship first, tune from real user data |
