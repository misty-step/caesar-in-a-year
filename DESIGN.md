# Design: Checkpoint 2 (Code Health)

Source: `TASK.md` (2.1–2.3). Goal: delete dead UI, collapse duplicated types, remove unused API surface.

## Architecture Overview
**Selected Approach**: Single canonical domain-types module + single session-advance entrypoint.

**Rationale**: Today we have two problems: duplicated types (`types.ts` vs `lib/data/types.ts`) and duplicated “advance” entrypoints (server action + API route). Both cause drift, subtle bugs, and extra cognitive load. Fix by making one place “truth” and deleting the rest.

**Core Modules**
- `lib/data/types.ts` — canonical domain model + `DataAdapter` contract.
- `lib/data/adapter.ts` — runtime selection (Convex vs in-memory) behind `DataAdapter`.
- `app/(app)/session/[sessionId]/actions.ts` — core session flows (grade, record, advance).
- `app/api/grade/route.ts` — HTTP boundary for client fetch (kept; used by Session UI).

**Data Flow**
User (Session UI) → `POST /api/grade` → `submitReviewForUser()` → (AI grade + recordAttempt + recordReview) → `advanceSession()` → `DataAdapter.advanceSession()` → response `{ result, nextIndex, status }`.

**Key Decisions**
1. Canonical types live in `lib/data/types.ts` (not root `types.ts`) — reduces drift, makes `lib/` the vocab owner.
2. One “advance session” entrypoint (`advanceSessionForUser()` only) — removes unused `/api/session/advance` surface.
3. View-model types stay local to UI routes/components — avoid reintroducing a global `types.ts` bucket.

---

## Module: `lib/data/types.ts` (Domain Types + DataAdapter)
Responsibility: define shared domain vocabulary; hide storage implementation behind `DataAdapter`.

Public Interface (canonical; no imports from `@/types`):
```ts
export enum GradeStatus { CORRECT, PARTIAL, INCORRECT }
export type GradingResult = { status: GradeStatus; feedback: string; correction?: string };

export type SessionItem =
  | { type: 'REVIEW'; sentence: Sentence }
  | { type: 'NEW_READING'; reading: ReadingPassage };

export interface DataAdapter {
  getUserProgress(userId: string): Promise<UserProgress | null>;
  upsertUserProgress(progress: UserProgress): Promise<void>;
  getContent(userId: string): Promise<ContentSeed>;
  createSession(userId: string, items: SessionItem[]): Promise<Session>;
  getSession(sessionId: string, userId: string): Promise<Session | null>;
  advanceSession(params: { sessionId: string; userId: string; nextIndex: number; status: SessionStatus }): Promise<Session>;
  recordAttempt(attempt: Attempt): Promise<void>;
  getDueReviews(userId: string, limit?: number): Promise<ReviewSentence[]>;
  getReviewStats(userId: string): Promise<ReviewStats>;
  recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void>;
  getMasteredAtLevel(userId: string, maxDifficulty: number): Promise<number>;
  incrementDifficulty(userId: string, increment?: number): Promise<{ maxDifficulty: number }>;
}
```

Internal Notes
- Keep `lib/data/types.ts` import-free (except types from itself). No `@/types` backrefs.
- Treat `SessionItem['type']` string literals as the only discriminator; delete `SegmentType` enum.

---

## Module: Dashboard View Model Types (UI-only)
Responsibility: represent “what dashboard renders”, not “what DB stores”.

Design: define `UserProgressVM` (or keep `UserProgress` name) local to dashboard module.

Suggested shape (mirrors current UI expectations, derived from data-progress):
```ts
export type UserProgressVM = {
  currentDay: number;
  totalXp: number;
  streak: number;
  unlockedPhase: number;
};
```

Where:
- `app/(app)/dashboard/page.tsx` owns the mapping `DataUserProgress -> UserProgressVM`.
- `components/dashboard/*` accept `UserProgressVM`.

This is the replacement for the root `types.ts` “global UI type bucket”.

---

## Module: `app/(app)/session/[sessionId]/actions.ts` (Session Flows)
Responsibility: single deep module for “grade + persist + advance” with explicit invariants.

Public Interface:
```ts
export function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult>;
export function submitReviewForUser(params: SubmitReviewInput & { userId: string; token?: string; tzOffsetMin?: number; aiAllowed?: boolean }): Promise<SubmitReviewResult>;
export function advanceSessionForUser(params: { userId: string; sessionId: string; token?: string }): Promise<{ nextIndex: number; status: SessionStatus }>;
```

Key Invariants (enforced)
- `itemIndex === session.currentIndex` else throw `Out of sync` (prevents race/regress).
- `advanceSession()` is pure and monotonic; persistence layer must not regress `currentIndex`.

Error Handling Strategy
- Server action entrypoints (`submitReview`) throw on auth failure and invariant violations.
- HTTP routes (`/api/grade`) translate bad inputs to `400`, missing auth to `401`, unexpected to `500`.

---

## Module: `app/api/grade/route.ts` (HTTP Boundary)
Responsibility: validate payload, apply AI rate-limit, call `submitReviewForUser()`, return JSON.

Design Notes
- Keep this route because Session UI uses `fetch('/api/grade')`.
- Keep rate limiting here (HTTP boundary) so actions stay deterministic and testable.

Payload contract:
```ts
type GradeRequest = { sessionId: string; itemIndex: number; userInput: string; tzOffsetMin?: number };
type GradeResponse = SubmitReviewResult & { rateLimit: { remaining: number; resetAtMs: number } };
```

---

## Removal: `app/api/session/advance/*` (Orphan API)
Current state: route exists + tested, but no callers in app code (only self-references + test).

Decision: delete entire `app/api/session/advance/` directory and its tests.

Replacement: callers that need “advance without grading” use `advanceSessionForUser()` directly (server-side), or add a new HTTP endpoint only when a real client needs it (mobile, external integration).

---

## Core Algorithms (Pseudocode)

### Type Consolidation (2.2)
1. Move `GradeStatus` + `GradingResult` into `lib/data/types.ts`.
2. Update all imports of `@/types` to import from `@/lib/data/types`:
   - `lib/ai/*`, `lib/srs/*`, `components/Session/*`, `app/(app)/session/*`, dashboard types.
3. Delete `types.ts` (and `SegmentType`).
4. Add local `UserProgressVM` type for dashboard (no global types file).
5. Run `pnpm lint` + `pnpm vitest`.

### Delete Dead Components (2.1)
1. Confirm no imports of `components/Dashboard.tsx` and `components/Layout.tsx` (already true via search).
2. Delete both files.
3. Run `pnpm lint` (ensures no stale imports).

### Remove Orphaned API Route (2.3)
1. Confirm no usage of `/api/session/advance` (only route/test currently).
2. Delete `app/api/session/advance/route.ts` and `app/api/session/advance/__tests__/route.test.ts`.
3. Ensure no docs point at it (README “Under the hood” line).
4. Run `pnpm vitest` (removes route test, ensures nothing else relies on it).

---

## File Organization (Planned Diffs)
- Delete `components/Dashboard.tsx`
- Delete `components/Layout.tsx`
- Delete `app/api/session/advance/route.ts`
- Delete `app/api/session/advance/__tests__/route.test.ts`
- Delete `types.ts`
- Update `lib/data/types.ts` to own grading types (no import from `@/types`)
- Update imports across:
  - `lib/ai/gradeTranslation.ts`, `lib/ai/gradeGist.ts`, related tests
  - `lib/srs/fsrs.ts`, related tests
  - `components/Session/ReviewStep.tsx`, `components/Session/ReadingStep.tsx`
  - `app/(app)/dashboard/page.tsx`, `components/dashboard/Stats.tsx`
  - `app/(app)/session/[sessionId]/actions.ts`
- Optional (doc hygiene): update README/CLAUDE/GEMINI to stop claiming `/api/session/advance` exists.

---

## Integration Points
- **Auth**: Clerk middleware (`middleware.ts`) protects `(app)`; server actions/routes use `auth()` again defensively.
- **AI**: Gemini graders in `lib/ai/*`; called only from `submitReviewForUser()`; rate limiting decided in `/api/grade`.
- **Data**: `createDataAdapter(token)` chooses Convex vs in-memory; in production token required.
- **Env Vars**: `GEMINI_API_KEY`, Clerk keys; Convex URL via Convex tooling (`pnpm dev` runs `convex dev`).

## Infrastructure Audit (Current)
- **Quality gates**: no `.github/` workflows, no pre-commit hooks; local-only `pnpm lint` + `pnpm vitest`.
- **Build/deploy**: Next.js build (`pnpm build`) + server (`pnpm start`); Convex runs in dev via `pnpm dev`.
- **Design system**: Tailwind tokens (`roman-*`, `pompeii-*`), primitives in `components/UI/*`.
- **Observability**: `console.*` logging; no error tracking, no tracing.

Observability (current)
- `console.*` logging; no structured logger boundary, no Sentry.
- Convex adapter has a tiny structured logger; expand only if/when CI + prod deploy exists.

---

## State Management
- Client: `SessionClient` holds `currentIndex` + `status` locally; advances only after server confirms.
- Server: session pointer stored in adapter; `advanceSession()` monotonic + adapter clamps index (already implemented).
- Concurrency: `submitReviewForUser()` rejects “out of sync” itemIndex; UI should refresh on this error (future).

---

## Error Handling Strategy
Categories:
- Validation (bad payload) → `400` JSON `{ error: 'Invalid payload' }`.
- Auth missing → `401`.
- Invariant (out-of-sync, missing session/item) → throw in actions; API boundary returns `500` today (option: map to `409` later).
- External (AI/Convex) → best-effort fallbacks already exist:
  - AI unavailable: use `aiAllowed=false` or catch in client, return `GradeStatus.PARTIAL` w/ correction.
  - recordAttempt/recordReview failures: log + continue.

Sensitive data
- Never log user input; if logging session IDs, truncate in logs (Convex adapter already truncs userId).

---

## Testing Strategy
Goal: keep existing coverage, delete tests for deleted surfaces, add none unless needed.

Unit tests to update (import-path only)
- `lib/ai/__tests__/gradeTranslation.test.ts`
- `lib/srs/__tests__/fsrs.test.ts`
- Any TS compile errors from moved types.

Route tests
- Delete `app/api/session/advance/__tests__/route.test.ts` with the route.
- Keep `app/api/grade/__tests__/route.test.ts` (critical path; includes rate-limit behavior).

Commands
- `pnpm vitest`
- `pnpm lint`

---

## Performance & Security Notes
- Removing unused route reduces attack surface and maintenance load.
- Types consolidation removes accidental runtime coupling (`lib/data/types.ts` currently imports from `@/types`).
- Keep `runtime = 'nodejs'` on API routes needing SDKs/tokens; avoid edge runtime for Gemini/Convex.

---

## Alternative Architectures Considered

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A | Keep `types.ts` canonical; `lib/data/types.ts` imports/re-exports | Minimal churn | Root “types bucket” grows; `lib/` leaks vocab ownership | Reject |
| B | Canonical `lib/data/types.ts`; keep `types.ts` as re-export shim | Low churn, gradual migration | Still two public entrypoints; easy to keep using shim forever | Consider only if diff size matters |
| C | Canonical `lib/data/types.ts`; delete `types.ts`; colocate view-model types | One truth; clear ownership; least long-term complexity | Larger one-time diff | **Select** |
| D | Keep `/api/session/advance` “just in case” | Future mobile client ready | Dead surface now; duplicates `advanceSessionForUser()`; docs drift | Reject |

Rubric scores (Simplicity 40%, Module depth 30%, Explicitness 20%, Robustness 10%)
- A: 5.5/10
- B: 7.0/10
- C: 8.3/10
- D: 4.8/10

---

## Open Questions / Assumptions
- Any external client (mobile/CLI) depends on `POST /api/session/advance`? If yes, keep it and add a real caller + contract test.
- Do we want to map “Out of sync” to HTTP `409` (better UX) instead of `500`? (Nice-to-have; not in Checkpoint 2.)
