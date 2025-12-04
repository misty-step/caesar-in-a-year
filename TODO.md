# TODO: Convex Persistence Layer

## Context
- **Architecture**: Hybrid Adapter (DESIGN.md) - Convex for persistence, memory for ephemeral sessions
- **Key Files**: `convex/`, `lib/data/`, `app/layout.tsx`
- **Test Pattern**: Vitest with `describe`/`it`, co-located in `__tests__/` folders
- **Build/Lint**: `pnpm build`, `pnpm lint`

## Phase 1: Foundation (parallel-ready)

- [x] Create Convex auth config for Clerk JWT validation
  ```
  Files: convex/auth.config.js (new)
  Approach: See DESIGN.md Module: convex/auth.config.js
  Success: `npx convex dev` accepts Clerk JWTs
  Test: Manual - authenticate via Clerk, Convex mutation succeeds
  Env: Set CLERK_JWT_ISSUER_DOMAIN via `npx convex env set`
  Time: 15min
  ```

- [x] Extend Convex schema with userProgress and sentenceReviews tables
  ```
  Files: convex/schema.ts (modify)
  Approach: Add two defineTable() calls per DESIGN.md schema spec
  Success: `npx convex dev` syncs without errors, tables visible in dashboard
  Test: Manual - verify tables in Convex dashboard
  Dependencies: None
  Time: 15min
  ```

- [x] Implement pure SRS bucket algorithm
  ```
  Files: lib/data/srs.ts (new), lib/data/__tests__/srs.test.ts (new)
  Approach: Pure functions, no I/O - see DESIGN.md Module: lib/data/srs.ts
  Interface:
    - calculateNextReview(bucket, correct, incorrect, status, now?) → SRSUpdate
    - isDue(nextReviewAt, now?) → boolean
    - BUCKET_INTERVALS = [1, 3, 7, 14, 30]
  Success: All edge cases pass - bucket clamping, interval calculation
  Test: Unit tests covering CORRECT/PARTIAL/INCORRECT, floor/ceiling, timestamp math
  Dependencies: None (pure module)
  Time: 30min
  ```

- [x] Fix admin domain check in sentences.ts
  ```
  Files: convex/sentences.ts:29
  Approach: Change "@mistystep.com" to "@mistystep.io"
  Success: Admin check uses correct domain
  Test: Manual - verify via code review
  Dependencies: None
  Time: 5min
  ```

## Phase 2: Convex Functions (sequential after schema)

- [x] Implement userProgress Convex functions
  ```
  Files: convex/userProgress.ts (new)
  Approach: query `get` + mutation `upsert` per DESIGN.md pseudocode
  Interface:
    - get({ userId }) → UserProgressDoc | null
    - upsert({ userId, streak, totalXp, maxDifficulty, lastSessionAt }) → void
  Success: Auth required, userId validation, upsert pattern works
  Test: Manual via Convex dashboard - insert, update, query
  Dependencies: schema.ts complete
  Time: 30min
  ```

- [x] Implement reviews Convex functions
  ```
  Files: convex/reviews.ts (new)
  Approach: Per DESIGN.md - getDue, getStats, record
  Interface:
    - getDue({ userId, limit? }) → ReviewWithSentence[]
    - getStats({ userId }) → { dueCount, totalReviewed, masteredCount }
    - record({ userId, sentenceId, bucket, nextReviewAt, ... }) → void
  Success: FK validation on sentenceId, upsert pattern, due filtering works
  Test: Manual - create reviews, verify getDue returns past-due only
  Dependencies: schema.ts complete
  Time: 45min
  ```

- [ ] Implement GDPR deletion endpoint
  ```
  Files: convex/users.ts (new)
  Approach: Per DESIGN.md - deleteAllData mutation
  Interface: deleteAllData({ userId }) → { deleted: { reviews: number, progress: boolean } }
  Success: Deletes all user data, returns counts
  Test: Manual - create data, delete, verify empty
  Dependencies: schema.ts, userProgress.ts, reviews.ts complete
  Time: 20min
  ```

## Phase 3: TypeScript Layer (sequential after Convex)

- [ ] Extend DataAdapter types with SRS methods
  ```
  Files: lib/data/types.ts (modify)
  Approach: Add ReviewSentence, ReviewStats, extend DataAdapter interface
  Changes:
    - Add ReviewSentence interface (extends Sentence + reviewCount)
    - Add ReviewStats interface
    - Update UserProgress (day→maxDifficulty, add lastSessionAt)
    - Add getDueReviews, getReviewStats, recordReview to DataAdapter
  Pre-check (Grug warning): grep for `unlockedPhase` and `progress.day` usage first!
  Success: Types compile, existing code unchanged
  Test: `pnpm build` succeeds
  Dependencies: None (types only)
  Time: 20min
  ```

- [ ] Implement ConvexAdapter bridging DataAdapter to Convex
  ```
  Files: lib/data/convexAdapter.ts (new)
  Approach: Class implementing DataAdapter per DESIGN.md pseudocode
  Implementation:
    - getUserProgress/upsertUserProgress → Convex userProgress functions
    - getDueReviews/getReviewStats/recordReview → Convex reviews functions
    - createSession/getSession/advanceSession → delegate to memory adapter
    - recordAttempt → no-op (Phase 1)
    - getContent → Convex sentences + static reading
  Success: All DataAdapter methods work, sessions stay ephemeral
  Test: Unit test with mocked Convex client
  Dependencies: types.ts, srs.ts, Convex functions complete
  Time: 60min
  ```

- [ ] Update adapter factory to use ConvexAdapter
  ```
  Files: lib/data/adapter.ts (modify)
  Approach: Pass client as parameter (avoid global state per Grug review)
  Changes:
    - createDataAdapter(client?: ConvexReactClient) → DataAdapter
    - Return ConvexAdapter when client provided, memory adapter otherwise
    - NO global mutable state (setConvexClient anti-pattern)
  Success: Factory returns correct adapter, no global state
  Test: Import and verify behavior with/without client parameter
  Dependencies: convexAdapter.ts complete
  Time: 15min
  ```

## Phase 4: Provider Wiring (last)

- [ ] Wire ConvexProviderWithClerk in app layout
  ```
  Files: app/layout.tsx (modify)
  Approach: Wrap children with ConvexProviderWithClerk per DESIGN.md
  Changes:
    - Import ConvexProviderWithClerk, ConvexReactClient, useAuth
    - Create convex client with NEXT_PUBLIC_CONVEX_URL
    - Nest inside ClerkProvider
  Env: Add NEXT_PUBLIC_CONVEX_URL to .env.local
  Success: App loads, Convex client available in components
  Test: Manual - app renders, no console errors
  Dependencies: All Convex functions complete
  Time: 20min
  ```

## Acceptance Verification

After all tasks complete, verify DESIGN.md Phase 1 criteria:
- [ ] `npx convex dev` runs without errors
- [ ] User authenticates via Clerk → Convex mutations work
- [ ] userProgress persists across browser refresh
- [ ] sentenceReviews created after grading
- [ ] getDueReviews returns sentences at correct times
- [ ] No duplicate reviews per (userId, sentenceId)
- [ ] GDPR deletion removes all user data

## Total Time Estimate

| Phase | Tasks | Time |
|-------|-------|------|
| Foundation | 4 | ~65min |
| Convex Functions | 3 | ~95min |
| TypeScript Layer | 3 | ~95min |
| Provider Wiring | 1 | ~20min |
| **Total** | **11** | **~4.5hr** |

## Parallelization Notes

**Can run in parallel:**
- Phase 1 tasks (auth config, schema, SRS module, domain fix)

**Must be sequential:**
- Convex functions → after schema
- TypeScript adapter → after Convex functions
- Provider wiring → last

## Not in Scope (deferred)

- Attempts table (Phase 3 analytics)
- FSRS algorithm upgrade (Phase 3)
- Session persistence (intentionally ephemeral)
- Dashboard UI changes (separate PR)

## Grug Warnings

From complexity review - watch for these anti-patterns:

1. **ConvexAdapter must have real logic** - if just `return this.client.whatever()` everywhere, it's a shallow wrapper. Must have: defaults, type mapping, SRS calculation orchestration
2. **Keep srs.ts pure forever** - no database, no network, only math
3. **Watch DataAdapter growth** - currently 10 methods, if it hits 15+ split the interface
4. **No global mutable state** - factory takes client as param, not via setter
