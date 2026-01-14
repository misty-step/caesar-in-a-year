# ADR 0008: Convex as Primary Database

## Status
Accepted

## Context
The app needs:
- User progress persistence
- Session state that survives serverless function restarts
- Review scheduling with timestamp-based queries
- Real-time potential (future: collaborative features)

**Alternatives considered:**
1. PostgreSQL (Neon/Supabase) - proven, SQL, requires connection pooling
2. MongoDB Atlas - document-oriented, but separate from compute
3. Convex - unified functions + database, real-time built-in
4. PlanetScale - MySQL-compatible, good scaling, but SQL overhead

## Decision
Use Convex as the primary database with these characteristics:

**Schema design:** Denormalized for query efficiency (e.g., `sentenceDifficulty` copied to reviews table for mastery queries).

**Index strategy:**
- `by_user_due` for FSRS scheduling queries
- `by_sentence_id` for content lookup
- `by_difficulty` for content gating

**Session storage:** `items` stored as `v.any()` (polymorphic JSON) because Convex doesn't support union types with different shapes cleanly.

## Consequences

**Good:**
- No connection pooling needed (Convex handles it)
- Real-time subscriptions available if needed
- Functions and database co-located (lower latency)
- TypeScript throughout (queries, mutations, schema)

**Bad:**
- Vendor lock-in (no standard SQL export)
- `v.any()` for SessionItem loses type safety at DB boundary
- Query language is different from SQL (learning curve)
- Limited control over query optimization

**Why accept v.any() for items?**
SessionItem is a discriminated union with different shapes per type. Convex's validator system doesn't handle this cleanly. The adapter layer reconstructs types on fetch, so application code remains typed.

**Future consideration:** If data portability becomes critical, could add a sync-to-PostgreSQL backup job.
