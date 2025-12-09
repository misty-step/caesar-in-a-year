# TODO: Full Corpus Content Selection

## Context
- **Architecture**: Adapter-based selection (see DESIGN.md)
- **Key Files**: convex/sentences.ts, convex/reviews.ts, lib/data/convexAdapter.ts
- **Patterns**: Convex mutations follow existing auth pattern in reviews.ts

## Phase 1: Corpus Generation

- [x] Generate full corpus and validate output
  ```
  Files: content/corpus.json (output)
  Action: Run `pnpm corpus:process-all`, validate result
  Success:
    - 2,211 sentences generated (some chapters missing translations)
    - Order values sequential 1..N (no gaps)
    - No duplicate IDs
    - Difficulty distribution: uniform 1-100 (percentile-based)
  ```

- [x] Fix difficulty scoring (BONUS - discovered during validation)
  ```
  Problem: Difficulty clustered at 50-70 (152-word frequency table)
  Solution: Two-pass corpus processing with percentile ranking
  Files:
    - scripts/corpus/models.py: FrequencyBuilder, calculate_raw_difficulty, assign_percentile_difficulties
    - scripts/process-corpus.py: Two-pass architecture
    - content/latin_frequency.json: 7,000+ word corpus-derived table
  Result: Uniform distribution 1-100, ~220 sentences per decile
  ```

## Phase 2: Safe Corpus Sync

- [x] Add syncCorpus mutation with orphan protection
  ```
  Files: convex/sentences.ts
  Pattern: Follow auth pattern from convex/reviews.ts:8-15
  Success:
    - Mutation upserts (patch existing, insert new)
    - Orphan check runs BEFORE any changes
    - Throws ConvexError with sentence IDs if would orphan
    - Deletes stale sentences (no reviews)
    - Returns { synced: number, deleted: number }
  ```

- [x] Update corpus-sync.ts to use syncCorpus + backup
  ```
  Files: scripts/corpus-sync.ts
  Changes:
    - Add createBackup() function (export current sentences to backups/)
    - Call backup before sync
    - Use sentences:syncCorpus instead of sentences:replaceAll
    - Log synced/deleted counts
  ```

## Phase 3: Content Selection

- [x] Add getSentenceIds query to convex/reviews.ts
  ```
  Files: convex/reviews.ts
  Pattern: Follow existing query pattern (getOne, getDue)
  Success: Returns string[] of sentenceIds for user
  ```

- [x] Update DataAdapter interface to require userId in getContent
  ```
  Files: lib/data/types.ts
  Change: getContent(): Promise<ContentSeed> → getContent(userId: string): Promise<ContentSeed>
  ```

- [x] Enhance ConvexAdapter.getContent() with selection logic
  ```
  Files: lib/data/convexAdapter.ts
  Changes:
    - Add DEFAULT_MAX_DIFFICULTY = 10
    - Add mapToReading() helper
    - Implement selection: progress → candidates → seen filter → sort → slice
  ```

- [x] Update memoryAdapter for interface parity
  ```
  Files: lib/data/adapter.ts
  Change: getContent() → getContent(userId: string)
  ```

- [x] Update getContent call sites with userId
  ```
  Files:
    - app/(app)/dashboard/page.tsx
    - app/(app)/session/new/page.tsx
  ```

## Phase 4: Manual Level-Up

- [x] Add incrementDifficulty mutation
  ```
  Files: convex/userProgress.ts
  Success:
    - Increments maxDifficulty by specified amount
    - Caps at 100
    - Creates progress if missing (starting at 10 + increment)
  ```

- [x] Add level-up button to dashboard
  ```
  Files:
    - components/dashboard/LevelUpButton.tsx (new)
    - app/(app)/dashboard/page.tsx
  Success:
    - Button visible on dashboard
    - Click increments difficulty by 5
    - Disabled at 100, shows "All content unlocked!"
  ```

## Validation Checklist

After all tasks:
- [ ] `pnpm corpus:sync --dry-run` validates full corpus
- [ ] `pnpm corpus:sync` completes without orphan errors (requires Convex deployment)
- [ ] New user sees difficulty ≤ 10 sentences (requires E2E testing)
- [ ] Level-up button unlocks harder content (requires E2E testing)
- [x] `pnpm lint` passes (warnings only - intentional await in loops)
- [x] `pnpm build` succeeds

## Additional Work Done

- [x] Fix build for static page generation (app/providers.tsx)
  ```
  Problem: Static build failed without NEXT_PUBLIC_CONVEX_URL
  Solution: Graceful fallback when Convex URL missing
  ```

- [x] Footer component and 404 page updates
  ```
  Files: components/UI/Footer.tsx, app/not-found.tsx
  ```

## Remaining Work

### Required for Production
- [ ] Deploy to Convex and run `pnpm corpus:sync`
- [ ] Manual E2E testing of content selection flow
- [ ] Manual E2E testing of level-up button

### Known Issues
- 34 chapters missing English translations (MIT Classics HTML parsing issues)
  - Book 1: Ch 53-54
  - Book 7: Ch 60-90
  - Book 8: Ch 46
  - These sentences are excluded from corpus

### Future Enhancements (Out of Scope)
- Automatic level advancement (users know readiness better)
- Narrative ordering preference
- Vocabulary tracking
- Difficulty calibration from real user data
