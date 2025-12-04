# DESIGN.md - Convex Persistence Layer

## Architecture Overview

**Selected Approach**: Hybrid Adapter with Convex Persistence

**Rationale**: Extend existing `DataAdapter` interface with SRS methods. ConvexAdapter handles user progress and review persistence; sessions remain ephemeral in-memory. This minimizes migration risk while delivering core value (learning continuity).

**Core Modules**:
- `convex/schema.ts` - Extended schema with `userProgress`, `sentenceReviews` tables
- `convex/userProgress.ts` - User stats CRUD with streak calculation
- `convex/reviews.ts` - SRS state management (due queries, record reviews)
- `convex/users.ts` - GDPR deletion
- `lib/data/convexAdapter.ts` - DataAdapter implementation bridging to Convex
- `lib/data/srs.ts` - Pure SRS bucket algorithm (no side effects)

**Data Flow**:
```
Dashboard → getDueReviews() → ConvexAdapter → Convex reviews.getDue
ReviewStep → gradeTranslation → recordReview() → ConvexAdapter → Convex reviews.record
Session complete → updateUserProgress() → ConvexAdapter → Convex userProgress.upsert
```

**Key Design Decisions**:
1. **Hybrid adapter pattern** - ConvexAdapter for persistence, memory for ephemeral sessions (simplicity)
2. **SRS as pure functions** - Bucket logic extracted to testable pure module (explicitness)
3. **Unix ms timestamps everywhere** - Consistency with Convex numeric indexes (simplicity)
4. **No attempts table** - Defer analytics complexity to Phase 3 (minimalism)

---

## Module Design

### Module: `lib/data/srs.ts` (SRS Algorithm)

**Responsibility**: Encapsulate bucket-based spaced repetition logic. Pure functions, no I/O.

**Public Interface**:
```typescript
const BUCKET_INTERVALS: readonly number[] = [1, 3, 7, 14, 30]; // Days
const MAX_BUCKET = 4;

interface SRSUpdate {
  bucket: number;
  nextReviewAt: number; // Unix ms
  timesCorrect: number;
  timesIncorrect: number;
}

function calculateNextReview(
  currentBucket: number,
  timesCorrect: number,
  timesIncorrect: number,
  gradeStatus: GradeStatus,
  nowMs?: number
): SRSUpdate;

function isDue(nextReviewAt: number, nowMs?: number): boolean;
```

**Internal Implementation**:
- CORRECT: bucket + 1 (capped at MAX_BUCKET)
- PARTIAL: bucket unchanged
- INCORRECT: bucket - 1 (floor at 0)
- nextReviewAt = now + BUCKET_INTERVALS[bucket] * 86400000

**Dependencies**: None (pure module)

**Data Structures**:
```typescript
// Inputs match GradeStatus enum from types.ts
type GradeStatus = 'CORRECT' | 'PARTIAL' | 'INCORRECT';
```

**Error Handling**: None needed - pure math with clamping

---

### Module: `convex/schema.ts` (Extended Schema)

**Responsibility**: Define Convex table schemas with indexes for efficient queries.

**Public Interface** (Schema Definition):
```typescript
// EXISTING - unchanged
sentences: defineTable({
  sentenceId: v.string(),
  latin: v.string(),
  referenceTranslation: v.string(),
  difficulty: v.number(),
  order: v.number(),
  alignmentConfidence: v.optional(v.number()),
})
  .index("by_sentence_id", ["sentenceId"])
  .index("by_difficulty", ["difficulty"])
  .index("by_order", ["order"]),

// NEW - User-level stats
userProgress: defineTable({
  userId: v.string(),              // Clerk subject ID
  streak: v.number(),              // Consecutive days with activity
  totalXp: v.number(),             // Gamification points
  maxDifficulty: v.number(),       // Content gating (replaces unlockedPhase)
  lastSessionAt: v.number(),       // Unix ms - for streak calculation
})
  .index("by_user", ["userId"]),

// NEW - Per-sentence SRS state
sentenceReviews: defineTable({
  userId: v.string(),
  sentenceId: v.string(),
  bucket: v.number(),              // 0-4 mapping to intervals
  nextReviewAt: v.number(),        // Unix ms - when due
  lastReviewedAt: v.number(),      // Unix ms
  timesCorrect: v.number(),
  timesIncorrect: v.number(),
})
  .index("by_user_due", ["userId", "nextReviewAt"])
  .index("by_user_sentence", ["userId", "sentenceId"]),
```

**Index Rationale**:
- `by_user_due`: Compound index for `getDueReviews(userId, limit)` - filter by user, sort by due date
- `by_user_sentence`: Compound index for upsert pattern - unique lookup

---

### Module: `convex/userProgress.ts`

**Responsibility**: User stats persistence with streak calculation logic.

**Public Interface**:
```typescript
// Query: Get user progress (returns null if not found)
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<UserProgressDoc | null>
});

// Mutation: Create or update user progress
export const upsert = mutation({
  args: {
    userId: v.string(),
    streak: v.number(),
    totalXp: v.number(),
    maxDifficulty: v.number(),
    lastSessionAt: v.number(),
  },
  handler: async (ctx, args): Promise<void>
});
```

**Internal Implementation**:

```pseudocode
function get(userId):
  1. Query userProgress table with by_user index
  2. Return first match or null

function upsert(args):
  1. Require authentication (ctx.auth.getUserIdentity)
  2. Validate userId matches authenticated user (security)
  3. Query existing record by userId
  4. If exists: patch with new values
  5. If not exists: insert new record
```

**Dependencies**: Convex runtime, auth

**Error Handling**:
- Missing auth → ConvexError("Authentication required")
- userId mismatch → ConvexError("Cannot modify another user's progress")

---

### Module: `convex/reviews.ts`

**Responsibility**: SRS state persistence and due review queries.

**Public Interface**:
```typescript
// Query: Get due reviews for user
export const getDue = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),  // Default 10
  },
  handler: async (ctx, args): Promise<ReviewWithSentence[]>
});

// Query: Get review stats for dashboard
export const getStats = query({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<ReviewStats>
});

// Mutation: Record review result
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
  handler: async (ctx, args): Promise<void>
});
```

**Internal Implementation**:

```pseudocode
function getDue(userId, limit = 10):
  1. Get current time as Unix ms
  2. Query sentenceReviews with by_user_due index
     - Filter: userId matches AND nextReviewAt <= now
     - Order: nextReviewAt ascending (oldest due first)
     - Take: limit
  3. For each review, join with sentences table by sentenceId
  4. Return array of { sentence, reviewCount }

function getStats(userId):
  1. Query all sentenceReviews for userId
  2. Count: total reviewed (all records)
  3. Count: due now (nextReviewAt <= now)
  4. Count: mastered (bucket >= 4)
  5. Return { dueCount, totalReviewed, masteredCount }

function record(args):
  1. Require authentication
  2. Validate userId matches authenticated user
  3. Validate sentenceId exists in sentences table (foreign key)
  4. Query existing review by (userId, sentenceId) using by_user_sentence index
  5. If exists: patch with new SRS values
  6. If not exists: insert new review record
```

**Data Structures**:
```typescript
type ReviewWithSentence = {
  id: string;                    // sentenceId
  latin: string;
  referenceTranslation: string;
  reviewCount: number;           // timesCorrect + timesIncorrect
};

type ReviewStats = {
  dueCount: number;
  totalReviewed: number;
  masteredCount: number;
};
```

**Error Handling**:
- Missing auth → ConvexError("Authentication required")
- Invalid sentenceId → ConvexError("Sentence not found: {id}")
- userId mismatch → ConvexError("Cannot modify another user's reviews")

---

### Module: `convex/users.ts`

**Responsibility**: GDPR-compliant user data deletion.

**Public Interface**:
```typescript
export const deleteAllData = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<{ deleted: { reviews: number; progress: boolean } }>
});
```

**Internal Implementation**:

```pseudocode
function deleteAllData(userId):
  1. Require authentication
  2. Validate userId matches authenticated user (prevent deleting others' data)
  3. Delete all sentenceReviews for userId
     - Query by userId, collect all
     - Delete each (batch delete not available in Convex)
     - Count deleted
  4. Delete userProgress for userId
     - Query by userId
     - Delete if exists
  5. Return deletion counts for audit
```

**Error Handling**:
- Missing auth → ConvexError("Authentication required")
- Wrong userId → ConvexError("Can only delete your own data")

---

### Module: `convex/auth.config.js`

**Responsibility**: Configure Convex to accept Clerk JWTs.

**Implementation**:
```javascript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

**Environment Setup**:
- Add `CLERK_JWT_ISSUER_DOMAIN` to Convex environment variables
- Value from Clerk dashboard: `https://{your-clerk-domain}`

---

### Module: `lib/data/types.ts` (Extended)

**Responsibility**: Type definitions for DataAdapter interface.

**New Types**:
```typescript
// Extends Sentence with review metadata
export interface ReviewSentence extends Sentence {
  reviewCount: number;  // Total attempts
}

// Dashboard stats
export interface ReviewStats {
  dueCount: number;
  totalReviewed: number;
  masteredCount: number;  // bucket >= 4
}

// Extended UserProgress (replaces unlockedPhase with maxDifficulty)
export interface UserProgress {
  userId: string;
  streak: number;
  totalXp: number;
  maxDifficulty: number;  // Content gating threshold
  lastSessionAt: number;  // Unix ms
}

// Extended DataAdapter interface
export interface DataAdapter {
  // Existing methods (unchanged signatures)
  getUserProgress(userId: string): Promise<UserProgress | null>;
  upsertUserProgress(progress: UserProgress): Promise<void>;
  getContent(): Promise<ContentSeed>;
  createSession(userId: string, items: SessionItem[]): Promise<Session>;
  getSession(sessionId: string, userId: string): Promise<Session | null>;
  advanceSession(params: AdvanceSessionParams): Promise<Session>;
  recordAttempt(attempt: Attempt): Promise<void>;

  // NEW: Spaced repetition methods
  getDueReviews(userId: string, limit?: number): Promise<ReviewSentence[]>;
  getReviewStats(userId: string): Promise<ReviewStats>;
  recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void>;
}
```

---

### Module: `lib/data/convexAdapter.ts`

**Responsibility**: Bridge DataAdapter interface to Convex functions. Deep module hiding Convex specifics.

**Public Interface**: Implements `DataAdapter`

**Internal Implementation**:

```pseudocode
class ConvexAdapter implements DataAdapter:
  constructor(convexClient: ConvexReactClient)

  // USER PROGRESS
  async getUserProgress(userId):
    1. Call convex userProgress.get(userId)
    2. If null, return default progress { userId, streak: 0, totalXp: 0, maxDifficulty: 1, lastSessionAt: 0 }
    3. Map Convex doc to UserProgress type

  async upsertUserProgress(progress):
    1. Calculate streak based on lastSessionAt vs now
    2. Call convex userProgress.upsert(progress)

  // SESSIONS (delegated to memory adapter - ephemeral)
  async createSession(userId, items):
    return memoryAdapter.createSession(userId, items)

  async getSession(sessionId, userId):
    return memoryAdapter.getSession(sessionId, userId)

  async advanceSession(params):
    return memoryAdapter.advanceSession(params)

  // CONTENT (from Convex sentences table)
  async getContent():
    1. Query convex sentences.getByDifficulty(maxDifficulty)
    2. Pick random subset for reviews
    3. Build ContentSeed with review sentences + static reading

  // ATTEMPTS (no-op in Phase 1 - kept for interface compat)
  async recordAttempt(attempt):
    // No-op: attempts not persisted in Phase 1
    return

  // NEW: SPACED REPETITION
  async getDueReviews(userId, limit = 10):
    1. Call convex reviews.getDue(userId, limit)
    2. Map to ReviewSentence[]

  async getReviewStats(userId):
    1. Call convex reviews.getStats(userId)
    2. Return ReviewStats

  async recordReview(userId, sentenceId, result):
    1. Get existing review state (or defaults for first review)
    2. Call srs.calculateNextReview(bucket, correct, incorrect, result.status)
    3. Call convex reviews.record(userId, sentenceId, srsUpdate)
```

**Dependencies**:
- `convex/react` - ConvexReactClient
- `lib/data/srs` - Pure SRS algorithm
- Memory adapter (for sessions)

**Error Handling**:
- Convex errors propagate with ConvexError messages
- Network errors: Let caller handle (React error boundaries)

---

### Module: `lib/data/adapter.ts` (Modified Factory)

**Responsibility**: Factory function to create DataAdapter. Switches from memory to Convex.

**Modified Implementation**:
```typescript
import { ConvexAdapter } from './convexAdapter';

// Convex client instance (created once at app level)
let convexClient: ConvexReactClient | null = null;

export function setConvexClient(client: ConvexReactClient): void {
  convexClient = client;
}

export function createDataAdapter(): DataAdapter {
  if (!convexClient) {
    // Fallback for SSR or pre-hydration
    return memoryAdapter;
  }
  return new ConvexAdapter(convexClient);
}
```

---

### Module: `app/layout.tsx` (Modified)

**Responsibility**: Wire up ConvexProviderWithClerk.

**Modified Implementation**:
```tsx
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <html lang="en">
          <body>{children}</body>
        </html>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

---

## File Organization

```
convex/
  _generated/              # Auto-generated by Convex CLI
  auth.config.js           # NEW: Clerk JWT config
  schema.ts                # MODIFY: Add userProgress, sentenceReviews
  sentences.ts             # MODIFY: Fix admin domain → @mistystep.io
  userProgress.ts          # NEW: get, upsert mutations
  reviews.ts               # NEW: getDue, record, getStats
  users.ts                 # NEW: deleteAllData (GDPR)

lib/
  data/
    types.ts               # MODIFY: Add ReviewSentence, ReviewStats, extend DataAdapter
    srs.ts                 # NEW: Pure SRS algorithm
    convexAdapter.ts       # NEW: DataAdapter → Convex bridge
    adapter.ts             # MODIFY: Factory returns ConvexAdapter

app/
  layout.tsx               # MODIFY: Add ConvexProviderWithClerk
```

**Modifications to Existing Files**:
- `convex/sentences.ts:29` - Change `@mistystep.com` to `@mistystep.io`
- `lib/data/types.ts` - Add new types, extend interface
- `lib/data/adapter.ts` - Add Convex client management
- `app/layout.tsx` - Wrap with ConvexProviderWithClerk

---

## Integration Points

### Convex Schema (Database)

Tables defined above. Key constraints:
- `userProgress.userId` - Unique per user (enforced via upsert pattern)
- `sentenceReviews.(userId, sentenceId)` - Composite unique (enforced via upsert pattern)
- `sentenceReviews.sentenceId` → `sentences.sentenceId` - Validated in mutation

### Environment Variables

**New Convex Variables** (set via `npx convex env set`):
```bash
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev
```

**New .env.local**:
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### External Dependencies

None new. Using existing:
- Clerk (auth)
- Convex (already in package.json)

---

## State Management

**Client State**:
- Auth state via ClerkProvider (existing)
- Convex reactive queries auto-update on mutations
- Session state in SessionClient component (existing, unchanged)

**Server State**:
- `userProgress` in Convex (persistent)
- `sentenceReviews` in Convex (persistent)
- Sessions in memory (ephemeral, survives within process lifetime only)

**State Update Flow**:
1. User completes review → `recordReview()` → Convex mutation → reactive query updates dashboard
2. Session completes → `upsertUserProgress()` → Convex mutation → streak/XP update
3. Page refresh → Convex queries re-fetch fresh data

---

## Error Handling Strategy

**Error Categories**:
1. **Auth Errors (401)** - Convex throws ConvexError, caught in API route, return 401
2. **Validation Errors (400)** - ConvexError for missing sentenceId, invalid params
3. **Network Errors** - Convex client handles retry; surface via React error boundary
4. **Data Integrity** - FK validation in mutations; duplicates prevented via upsert

**Error Response Format** (API routes):
```typescript
// Success
{ result: GradingResult, nextIndex: number, status: SessionStatus }

// Error
{ error: string } // with appropriate HTTP status
```

**Logging**:
- Convex dashboard shows mutation/query logs automatically
- Critical errors logged via `console.error` in API routes

---

## Testing Strategy

**Unit Tests** (fast, no I/O):
- `lib/data/srs.test.ts` - SRS algorithm edge cases
  - CORRECT advances bucket
  - PARTIAL maintains bucket
  - INCORRECT regresses bucket
  - Bucket clamping (0 floor, 4 ceiling)
  - nextReviewAt calculation

**Integration Tests** (Convex test environment):
- `convex/reviews.test.ts` - Via Convex test harness
  - getDue returns only past-due reviews
  - record creates new review
  - record updates existing review (upsert)
  - FK validation rejects invalid sentenceId

**Existing Tests** (verify no regression):
- `lib/session/__tests__/session.test.ts` - Session logic unchanged
- `app/api/grade/__tests__/route.test.ts` - API contract unchanged

**Coverage Targets**:
- `lib/data/srs.ts` - 100% (critical algorithm)
- Convex mutations - 80%+ (integration tests)
- ConvexAdapter - 70% (mostly delegation)

**Mocking Strategy**:
- Mock ConvexReactClient in adapter tests
- Use Convex test environment for mutation tests
- No mocking of SRS module (pure functions)

---

## Performance Considerations

**Expected Load**:
- 1 user, ~50 reviews/day (solo founder use case)
- Sub-100ms target already met by Convex

**Optimizations**:
- Compound index `by_user_due` for efficient due query
- Limit default 10 on getDue to bound response size
- Convex caching handles read-heavy dashboard queries

**Scaling Strategy**:
- Convex auto-scales (no action needed)
- If many users: Consider pagination on getDue
- If analytics needed: Batch aggregation queries

---

## Security Considerations

**Threats Mitigated**:
- **Cross-user data access** - userId validation in every mutation
- **Admin role escalation** - Domain check @mistystep.io (fix existing .com bug)
- **Unauthenticated access** - ctx.auth.getUserIdentity() check in all mutations

**Security Best Practices**:
- Clerk handles all auth complexity
- Convex auth integration validates JWTs server-side
- No raw SQL (Convex prevents injection by design)
- GDPR deletion endpoint for user data rights

---

## Alternative Architectures Considered

### Alternative A: Full Convex Migration

Move sessions to Convex, eliminate memory adapter entirely.

**Pros**: Single source of truth, sessions survive restarts
**Cons**: Sessions don't need persistence (ephemeral by design), adds complexity
**Ousterhout Analysis**: Unnecessary persistence adds hidden state management
**Verdict**: Rejected - YAGNI; sessions are intentionally ephemeral

### Alternative B: SM-2 Algorithm

Use SuperMemo SM-2 algorithm instead of buckets.

**Pros**: Industry-proven, more sophisticated scheduling
**Cons**: More complex implementation, user can't perceive difference
**Ousterhout Analysis**: Added complexity for no user-visible benefit
**Verdict**: Rejected - Simple buckets ship faster; FSRS planned for Phase 3

### Alternative C: Attempts Table Now

Add `attempts` table for review history analytics.

**Pros**: Enables future analytics without migration
**Cons**: No current user benefit, adds storage/query complexity
**Ousterhout Analysis**: Premature abstraction; speculative requirement
**Verdict**: Rejected - Defer to Phase 3 when analytics needed

**Selected**: Hybrid adapter with minimal Convex tables
- **Justification**: Minimum viable persistence for core value (learning continuity)
- **Skills Applied**: Ousterhout principles (deep modules), YAGNI (no speculative features)

---

## Implementation Sequence

**Build Order** (dependency-aware):

1. **convex/auth.config.js** - Unblocks all Convex auth
2. **convex/schema.ts** - Adds tables (run `npx convex dev` to sync)
3. **lib/data/srs.ts** - Pure algorithm, no deps
4. **convex/userProgress.ts** - User stats CRUD
5. **convex/reviews.ts** - SRS persistence
6. **lib/data/types.ts** - Extend interface
7. **lib/data/convexAdapter.ts** - Bridge implementation
8. **lib/data/adapter.ts** - Factory modification
9. **app/layout.tsx** - Wire up provider
10. **convex/users.ts** - GDPR deletion
11. **Fix sentences.ts** - Admin domain correction

**Phase 1 Acceptance Criteria**:
- [ ] `npx convex dev` runs without errors
- [ ] User can authenticate via Clerk
- [ ] userProgress persists across browser refresh
- [ ] sentenceReviews created after grading
- [ ] getDueReviews returns sentences at correct times
- [ ] No duplicate reviews per (userId, sentenceId)
- [ ] GDPR deletion removes all user data

---

## Summary

This architecture delivers **learning continuity** (the core user value) through:

1. **Two new Convex tables** - userProgress, sentenceReviews
2. **Simple bucket SRS** - Ships in days, upgradeable to FSRS later
3. **Hybrid adapter** - Convex for persistence, memory for ephemeral sessions
4. **Clean type extension** - DataAdapter gains 3 methods, existing code unchanged

The design prioritizes **simplicity** and **minimalism** over speculation. Sessions stay ephemeral. Attempts table deferred. FSRS deferred. Only what's needed for the user to "close browser, return next day, see streak intact."
