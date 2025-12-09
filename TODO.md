# TODO: Full Corpus Content Selection

## Context
- **Architecture**: Adapter-based selection (see DESIGN.md)
- **Key Files**: convex/sentences.ts, convex/reviews.ts, lib/data/convexAdapter.ts
- **Patterns**: Convex mutations follow existing auth pattern in reviews.ts

## Phase 1: Corpus Generation

- [~] Generate full corpus and validate output
  ```
  Files: content/corpus.json (output)
  Action: Run `pnpm corpus:process-all`, validate result
  Pseudocode: DESIGN.md "Phase 1: Corpus Generation"
  Success:
    - ~3,000+ sentences generated
    - Order values sequential 1..N (no gaps)
    - No duplicate IDs
    - Difficulty distribution logged
  Dependencies: None
  Time: 4-6 hours (mostly runtime)
  ```

## Phase 2: Safe Corpus Sync

- [x] Add syncCorpus mutation with orphan protection
  ```
  Files: convex/sentences.ts
  Pattern: Follow auth pattern from convex/reviews.ts:8-15
  Pseudocode: DESIGN.md "Module: convex/sentences.ts" (lines 100-142)
  Success:
    - Mutation upserts (patch existing, insert new)
    - Orphan check runs BEFORE any changes
    - Throws ConvexError with sentence IDs if would orphan
    - Deletes stale sentences (no reviews)
    - Returns { synced: number, deleted: number }
  Test:
    - Empty DB → inserts all
    - Existing sentences → updates
    - Would orphan reviews → throws ConvexError
  Dependencies: None
  Time: 45min
  ```

- [~] Update corpus-sync.ts to use syncCorpus + backup
  ```
  Files: scripts/corpus-sync.ts
  Pattern: Existing Zod validation pattern (lines 18-36)
  Pseudocode: DESIGN.md "Module: scripts/corpus-sync.ts" (lines 154-181)
  Changes:
    - Add createBackup() function (export current sentences to backups/)
    - Call backup before sync
    - Use sentences:syncCorpus instead of sentences:replaceAll
    - Log synced/deleted counts
  Success:
    - Backup created at backups/corpus-{timestamp}.json
    - Uses new syncCorpus mutation
    - Clear error on orphan detection
  Dependencies: syncCorpus mutation
  Time: 30min
  ```

## Phase 3: Content Selection

- [ ] Add getSentenceIds query to convex/reviews.ts
  ```
  Files: convex/reviews.ts
  Pattern: Follow existing query pattern (getOne, getDue)
  Pseudocode: DESIGN.md "Module: convex/reviews.ts" (lines 200-214)
  Success:
    - Returns string[] of sentenceIds for user
    - Uses by_user_sentence index
    - Auth check via assertAuthenticated
  Test: User with 5 reviews → returns 5 IDs
  Dependencies: None
  Time: 15min
  ```

- [ ] Update DataAdapter interface to require userId in getContent
  ```
  Files: lib/data/types.ts
  Change: getContent(): Promise<ContentSeed> → getContent(userId: string): Promise<ContentSeed>
  Success: TypeScript compilation catches all call sites
  Dependencies: None
  Time: 5min
  ```

- [ ] Enhance ConvexAdapter.getContent() with selection logic
  ```
  Files: lib/data/convexAdapter.ts
  Pattern: Existing getUserProgress, getDueReviews calls
  Pseudocode: DESIGN.md "Enhanced getContent()" (lines 228-267)
  Changes:
    - Add DEFAULT_MAX_DIFFICULTY = 10
    - Add mapToReading() helper
    - Implement selection: progress → candidates → seen filter → sort → slice
  Success:
    - New user gets difficulty ≤ 10 sentences
    - Excludes seen sentences
    - Returns fallback when level exhausted
  Test:
    - New user → easiest sentences
    - User with reviews → excludes seen
    - maxDifficulty=50 → sentences ≤ 50
  Dependencies: getSentenceIds query, interface change
  Time: 45min
  ```

- [ ] Update memoryAdapter for interface parity
  ```
  Files: lib/data/adapter.ts
  Change: getContent() → getContent(userId: string)
  Pattern: Keep simple - no real filtering (that's Convex's job)
  Success: Interface matches, dev mode works
  Dependencies: Interface change
  Time: 10min
  ```

- [ ] Update getContent call sites with userId
  ```
  Files:
    - app/(app)/dashboard/page.tsx:26
    - app/(app)/session/new/page.tsx:19
    - lib/data/convexAdapter.ts:159 (createSession)
  Pattern: Pass userId from auth context
  Success: All call sites compile, runtime works
  Dependencies: All adapter changes
  Time: 15min
  ```

## Phase 4: Manual Level-Up

- [ ] Add incrementDifficulty mutation
  ```
  Files: convex/userProgress.ts
  Pattern: Follow existing upsert mutation (lines 23-63)
  Pseudocode: DESIGN.md "Module: convex/userProgress.ts" (lines 339-371)
  Success:
    - Increments maxDifficulty by specified amount
    - Caps at 100
    - Creates progress if missing (starting at 10 + increment)
    - Auth check matches pattern
  Test:
    - maxDifficulty=10, increment=5 → 15
    - maxDifficulty=98, increment=5 → 100 (capped)
    - No progress → creates with 15
  Dependencies: None
  Time: 20min
  ```

- [ ] Add level-up button to dashboard
  ```
  Files: app/(app)/dashboard/page.tsx
  Pattern: Existing Button component usage (line 92)
  Pseudocode: DESIGN.md "UI Component: Dashboard Level-Up Button" (lines 380-394)
  Changes:
    - Import useMutation from convex/react
    - Add button below Stats or in new section
    - Disabled when maxDifficulty >= 100
    - Show "unlocked all content" message at cap
  Success:
    - Button visible
    - Click increments difficulty
    - Disabled at 100
  Dependencies: incrementDifficulty mutation
  Time: 30min
  ```

## Validation Checklist

After all tasks:
- [ ] `pnpm corpus:sync --dry-run` validates full corpus
- [ ] `pnpm corpus:sync` completes without orphan errors
- [ ] New user sees difficulty ≤ 10 sentences
- [ ] Level-up button unlocks harder content
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
