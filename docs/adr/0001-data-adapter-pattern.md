# ADR 0001: Data Adapter Pattern for Storage Abstraction

## Status
Accepted

## Context
The app needs persistent storage for user progress, sessions, reviews, and attempt history. The choice of database is not fixed early and may evolve. Development requires a working app without external dependencies. Production requires durable, authenticated storage.

**Alternatives considered:**
1. Direct Convex calls everywhere - tight coupling, harder to test, no local dev
2. Repository pattern with ORM - heavier abstraction than needed for this scale
3. Data Adapter interface - single abstraction boundary, swappable implementations

## Decision
Use a `DataAdapter` interface (`lib/data/types.ts`) that defines all persistence operations. Implementations:
- `memoryAdapter` (in `adapter.ts`): In-memory Maps for local development, zero setup
- `ConvexAdapter` (in `convexAdapter.ts`): Real persistence with Clerk auth tokens

Factory function `createDataAdapter(token?)` returns the appropriate adapter based on context:
- No token + development: memoryAdapter
- No token + production: throws error
- Token provided: ConvexAdapter

## Consequences

**Good:**
- Development works offline with no external services
- Easy to swap storage later (Neon, Planetscale, etc.)
- Clear API contract for all data operations
- Tests can mock the interface

**Bad:**
- Two implementations to maintain (memory is simple but incomplete)
- Some memoryAdapter methods return stubs (getDueReviews returns [], getProgressMetrics returns defaults)
- SessionItem stored as polymorphic JSON in Convex (`v.any()`) - loses type safety at DB boundary

**Why not just use Convex directly?**
Local development latency. Convex dev server requires network even locally. The memoryAdapter enables instant feedback during UI iteration.
