# Checkpoint 1: Core Loop Integrity — Design

## Architecture Overview
**Selected Approach**: Budgeted AI grading + always-advance session

**Rationale**: Keep one boring “grade+record+advance” pipeline. Rate limit gates AI calls only, never blocks session completion. Streak updates happen at the same boundary as “session became complete”, so resume is consistent.

**Core Modules**
- `lib/ai/gradeTranslation` — grades single-sentence meaning (existing)
- `lib/ai/gradeGist` — grades passage gist/comprehension (new)
- `lib/rateLimit/inMemoryRateLimit` — per-user AI budget (new, process-local)
- `app/(app)/session/[sessionId]/actions.submitReviewForUser` — orchestration: load session, grade (AI or fallback), record FSRS, advance pointer, update progress
- `lib/progress/streak` — pure streak math (new, tiny)

**Data Flow**
User → `POST /api/grade` → `submitReviewForUser` → (AI grader?) → `DataAdapter.recordReview` → `DataAdapter.advanceSession` → (if complete) `DataAdapter.upsertUserProgress`

**Key Decisions**
1. Rate limit AI, not learning: return 200 with fallback result + advancement.
2. Separate graders: gist != translation; prompts diverge.
3. Session pointer may equal `items.length` when complete; session page redirects to summary.
4. Streak uses user local day via client tz offset (best-effort DST).

## Module: `lib/ai/gradeGist`
Responsibility: grade “did you understand this passage?” not “did you parse every clause”.

Public Interface:
```ts
import type { GradingResult } from '@/types';

export async function gradeGist(input: {
  latin: string;            // full passage (joined)
  question: string;         // gist prompt shown to user
  userAnswer: string;       // user summary
  referenceGist: string;    // reference summary
  context?: string;         // book/chapter/etc
}): Promise<GradingResult>;
```

Internal Implementation
- Same reliability envelope as `gradeTranslation`: timeout, retry, circuit breaker, JSON schema.
- Prompt rubric:
  - judge comprehension (entities, relations, main claim)
  - accept paraphrase + partial credit
  - do not nitpick grammar
  - feedback: 1–3 sentences, actionable

Error Handling
- Empty answer → `INCORRECT` + “write something”
- AI unavailable → fallback `PARTIAL` + show reference gist (no throw)

## Module: `lib/rateLimit/inMemoryRateLimit`
Responsibility: decide if an AI call is allowed for `{userId}` in this process.

Public Interface:
```ts
export type RateLimitDecision =
  | { allowed: true; remaining: number; resetAtMs: number }
  | { allowed: false; remaining: 0; resetAtMs: number };

export function consumeAiCall(userId: string, nowMs: number): RateLimitDecision;
```

Design
- Fixed window 60m:
  - state: `Map<userId, { windowStartMs: number; count: number }>`
  - if `nowMs - windowStartMs >= 60m` → reset
  - if `count < 100` → increment, allow
  - else deny

Notes
- Process-local only (OK for MVP). In prod multi-instance, budget becomes “per instance”; acceptable until Upstash.
- Never throw; worst case allow.

## Module: `lib/progress/streak`
Responsibility: pure “given last activity timestamp and tz offset, compute next streak”.

Public Interface:
```ts
export function computeStreak(params: {
  prevStreak: number;
  prevLastSessionAtMs: number;   // 0 if none
  nowMs: number;                 // server time
  tzOffsetMin: number;           // from client (Date.getTimezoneOffset)
}): { nextStreak: number; nextLastSessionAtMs: number; didIncrement: boolean };
```

Rules (MVP)
- First completion → streak=1
- Same local day → streak unchanged
- Next local day → streak+1
- Otherwise → streak=1

Local day math (best-effort)
- `localDayIndex = floor((tsMs - tzOffsetMin*60_000) / 86_400_000)`
- DST caveat: uses current offset for prior timestamp too; can be off 1 day at DST boundary. Accept.

## Module: `submitReviewForUser` (grading + advance pipeline)
Responsibility: one entrypoint for correctness + persistence. No route/UI logic.

Public Interface (updated):
```ts
export async function submitReviewForUser(params: {
  userId: string;
  sessionId: string;
  itemIndex: number;
  userInput: string;
  token?: string;
  tzOffsetMin?: number;   // optional, for streak update
  aiAllowed?: boolean;    // optional, gate AI calls
}): Promise<{
  result: GradingResult;
  nextIndex: number;
  status: SessionStatus;
}>;
```

Dependencies
- Reads: `DataAdapter.getSession`, `DataAdapter.getUserProgress`
- Writes: `DataAdapter.recordAttempt`, `DataAdapter.recordReview`, `DataAdapter.advanceSession`, `DataAdapter.upsertUserProgress`
- Uses: `gradeTranslation`, `gradeGist`, `advanceSession`, `computeStreak`

Error Handling Strategy
- Validation/consistency errors:
  - session not found, item missing → throw (route maps to 404/400)
  - out-of-sync (`itemIndex !== session.currentIndex`) → throw typed error (route maps to 409)
- Operational errors: never block learning
  - AI failure / rate limit → fallback `GradingResult` + continue
  - `recordReview` failure → log + continue (FSRS degraded, session not blocked)
  - progress update failure → log + continue

## Core Algorithms (Pseudocode)

### `POST /api/grade`
1. auth via Clerk → `userId`, `token`
2. parse JSON body: `{sessionId, itemIndex, userInput, tzOffsetMin?}`
3. `decision = consumeAiCall(userId, Date.now())`
4. `result = submitReviewForUser({userId, token, ..., aiAllowed: decision.allowed, tzOffsetMin})`
5. return 200 with `{...result, rateLimit: { remaining, resetAtMs } }` (optional)

### `submitReviewForUser`
1. normalize `sessionId`
2. load session
3. validate `itemIndex === session.currentIndex`
4. pick grader:
   - REVIEW → `gradeTranslation(...)`
   - NEW_READING → `gradeGist(...)`
5. if `aiAllowed === false`:
   - skip AI call
   - `result = { status: PARTIAL, feedback: "...tutor unavailable...", correction: reference }`
6. best-effort:
   - `recordAttempt(...)` (no-op in Convex today)
   - if REVIEW → `recordReview(userId, sentenceId, result)`
7. `advanced = advanceSession(session)`
8. `updatedSession = data.advanceSession({ nextIndex: advanced.nextIndex, status: advanced.status })`
9. if `updatedSession.status === 'complete'`:
   - load progress
   - if `tzOffsetMin` present: `computeStreak(...)` using `nowMs = Date.now()`
   - update `totalXp += session.items.length` (or `+1`, see Open Questions)
   - `upsertUserProgress(...)` (best-effort)
10. return `{ result, nextIndex: updatedSession.currentIndex, status: updatedSession.status }`

### `SessionPage` redirect (resume correctness)
If session status is `complete`, redirect to `/summary/[sessionId]`.

## File Organization (Planned)
```
lib/
  ai/
    gradeTranslation.ts          (update: stop using for gist)
    gradeGist.ts                 (new)
  progress/
    streak.ts                    (new)
  rateLimit/
    inMemoryRateLimit.ts         (new)
  session/
    advance.ts                   (update: clamp edge cases, see tests)
    __tests__/
      advance.test.ts            (new)
lib/data/
  __tests__/
    convexAdapter.test.ts        (new)
app/api/grade/route.ts           (update: rate limit + tzOffset pass-through)
app/(app)/session/[sessionId]/actions.ts  (update: gradeGist + aiAllowed + progress update)
app/(app)/session/[sessionId]/page.tsx    (update: redirect if session complete)
components/Session/ReviewStep.tsx         (update: send tzOffsetMin)
components/Session/ReadingStep.tsx        (update: send tzOffsetMin)
```

## Integration Points
- Env: `GEMINI_API_KEY` (server only)
- Convex mutations/queries already used by `ConvexAdapter`
- No new third-party deps in this checkpoint

## State Management
- Server source of truth: session `currentIndex`, `status`, FSRS state, user progress.
- Client state: current input + “show result”.
- Resume: `SessionPage` reads persisted `currentIndex`; no client guessing.
- Concurrency:
  - out-of-sync check prevents double-submit from corrupting pointer
  - UI should disable submit while pending (already)

## Error Handling Strategy (HTTP)
- 400: invalid payload
- 401: unauthorized
- 404: session not found
- 409: out of sync (client should reload session)
- 200 with fallback grading when:
  - rate limit hit
  - AI unavailable / circuit open
  - FSRS write failed (still continue; log)

## Testing Strategy
**Unit**
- `lib/session/__tests__/advance.test.ts`
  - currentIndex at end → status complete, nextIndex clamped to `items.length`
  - currentIndex beyond end → stays complete, no runaway increment
  - empty items → complete, index 0
- `lib/rateLimit/__tests__/inMemoryRateLimit.test.ts` (optional)
  - allows first 100, denies 101st, resets after 60m

**Adapter**
- `lib/data/__tests__/convexAdapter.test.ts`
  - mocks `fetchQuery` (existing review doc) + `fetchMutation`
  - asserts `recordReview()` calls `scheduleReview()` and writes mapped fields (state, stability, due)
  - cover: new card (existing null) and existing card path

**Route**
- extend `app/api/grade/__tests__/route.test.ts`
  - when rate limited: still returns 200 and calls `submitReviewForUser` with `aiAllowed:false`

Coverage Targets (new code)
- Critical path (`submitReviewForUser`, rate limiter, streak math): 90%+ lines/branches

## Performance & Security Notes
- AI call budget: 100/hour/user (process-local).
- AI latency budget: `gradeTranslation` currently 5s timeout × retries; consider lowering attempts if UX suffers.
- Do not log raw `userInput` or full `userId`; truncate in logs.
- `tzOffsetMin` is client-controlled; treat as hint only. Worst-case user can “cheat” streak; acceptable for solo MVP.

## Alternative Architectures Considered

| Option | Pros | Cons | Score (Simp 40 / Depth 30 / Explicit 20 / Robust 10) | Verdict |
|---|---|---|---:|---|
| A) 429 on rate limit | trivial | blocks session, violates PRD | 40 | no |
| B) Budget AI, fallback + advance (selected) | simple, no UI work, never blocks | FSRS accuracy degraded when fallback | 84 | yes |
| C) Manual self-grade on fallback | FSRS stays accurate | extra endpoint + UI + idempotency complexity | 72 | later |
| D) Redis rate limit now | consistent across instances | adds infra + ops | 60 | later |
| E) Server actions (no `/api/grade`) | fewer moving parts | refactor client flow, harder to test | 65 | later |

## Open Questions / Assumptions
- XP: keep as hidden metric? If not, delete `totalXp` later (Checkpoint 2).
- Fallback FSRS: recordReview with PARTIAL vs skip? (selected: record, keeps loop simple)
- Gist prompt content: should reading question be “summary” everywhere (Convex `mapToReading` currently says “translate”)?
- DST correctness: accept best-effort offset math until we store timezone.

