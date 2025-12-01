## Architecture Overview
**Selected Approach**: Next.js 16 LTS App Router on Vercel with Turbopack default, Clerk authentication, **Convex as the sole data layer**, Vercel Functions (Node runtime) for Gemini grading, Vercel Analytics/Speed Insights + Sentry for observability, ready for cacheComponents and proxy.ts patterns.  
**Rationale**: Aligns with current LTS (Node ≥20.9), Turbopack stability, cache-friendly server components; minimizes infra surface, hides data complexity behind Convex, keeps AI calls server-side with tight schema control, preserves bilingual UI with minimal client state.

**Core Modules**
- `app/(public)` — marketing/landing (stub).
- `app/(auth)` — Clerk-provided routes (`/sign-in`, `/sign-up`, `/sso-callback`).
- `app/(app)/dashboard` — shows progress, CTA to continue.
- `app/(app)/session/[sessionId]` — orchestrates session queue, progress bar, item rendering.
- `app/(app)/summary/[sessionId]` — completion view + progress delta.
- `lib/data` — data access layer; interface with single concrete Convex adapter.
- `lib/ai/gradeTranslation` — server-only Gemini call with schema + guardrails.
- `lib/session` — session orchestration (build queue, advance, persist attempts).
- `components/ui` — Button, LatinText, ProgressBar, card shells (a11y-friendly).
- `components/session` — ReviewStep, ReadingStep wired to server actions.

**Data Flow**
User (Clerk auth) → `app` route loader (server components) → `lib/data` fetch progress/session → render dashboard/session. For grading: client action submits input → server action/route `gradeTranslation` → Gemini → result stored via `lib/data` → UI updates with feedback → `lib/session.advance` updates pointer.

**Key Decisions**
1. Server Actions + Route Handlers (Node runtime) for grading to ensure Clerk auth works without Edge constraints; deterministic retries; compatible with Next16 runtime rules.  
2. Data abstraction in `lib/data` but only one concrete adapter: Convex. Future swaps would add new adapter but are not shipped now.  
3. Session state stored server-side (Convex) to allow resume across devices; client holds only view state; cacheComponents can wrap data fetches where stable.  
4. Vercel Analytics + Sentry instrumentation baked into layout; structured logging in server handlers with request IDs.  
5. Tailwind via Next.js (not CDN) with shared tokens; keep existing roman/pompeii palette + font stack.

## Module Deep Dives
### Module: lib/data (DataAdapter)
Responsibility: Hide storage; expose typed functions for progress, content, sessions, attempts.

Public Interface (TypeScript):
```ts
export interface DataAdapter {
  getUserProgress(userId: string): Promise<UserProgress | null>;
  upsertUserProgress(progress: UserProgress): Promise<void>;
  getContent(): Promise<{ review: Sentence[]; reading: ReadingPassage }>;
  createSession(userId: string, items: SessionItem[]): Promise<Session>;
  getSession(sessionId: string, userId: string): Promise<Session | null>;
  advanceSession(params: {
    sessionId: string;
    userId: string;
    nextIndex: number;
    status: 'active' | 'complete';
  }): Promise<Session>;
  recordAttempt(attempt: Attempt): Promise<void>;
}
```
Internal (Convex): use Convex functions with schema validation; automatically scoped by userId.  
Internal (Neon): Drizzle schema for tables `users`, `progress`, `content`, `sessions`, `attempts`; use pooled connections (Edge-compat via neon-http if needed).

Error Handling: throw typed errors (`NotFound`, `Unauthorized`, `Conflict`); route handlers map to 4xx/5xx and log.

### Module: lib/ai/gradeTranslation
Responsibility: Single entry to Gemini; enforces schema + timeouts + circuit breaker.

Public Interface:
```ts
export async function gradeTranslation(input: {
  latin: string;
  userTranslation: string;
  reference: string;
  context?: string;
}): Promise<GradingResult>;
```

Internal Implementation:
- Validate inputs (length caps, non-empty).
- Compose prompt (supportive tutor).
- Use `@google/genai` with JSON Schema structured output (status/feedback/correction); model `models/gemini-2.5-flash`.
- Timeout (4s) and 2 retries with exponential backoff.
- On failure: return PARTIAL with friendly fallback + reference; log warning; increment metric.

### Module: lib/session
Responsibility: Build session queues, advance pointer, mark complete.

Public API:
```ts
buildSessionItems(content: ContentSeed): SessionItem[];
advanceSession(state: Session, action: 'next'): { nextIndex: number; status: 'active'|'complete' };
```
Rules: 3 review + 1 reading (current product); extensible via config. Guarantees idempotent completion (once status complete, no further advance).

### Components / UI
- `components/ui/Button` — keep cycle/tooltip behavior; add `aria-busy` when loading.
- `components/ui/LatinText` — same, ensure `lang="la"`/`lang="en"` spans; avoid layout shift.
- `components/session/ReviewStep` — calls server action `submitReview(itemId, userInput)`; shows grading result.
- `components/session/ReadingStep` — similar for gist; glossary tooltip; respects keyboard.

## Core Algorithms (Pseudocode)
### gradeTranslation (server)
1. Guard input lengths (<= 2000 chars).
2. If circuit breaker open → return PARTIAL fallback.
3. Call Gemini with schema; parse JSON.
4. If parse fails → log + return PARTIAL fallback.
5. Return `GradingResult`.

### submitReview (server action)
```
ensureAuthenticated(userId)
session = data.getSession(sessionId, userId)
if !session or session.items[index] not REVIEW -> throw 404/400
result = gradeTranslation(...)
data.recordAttempt({...})
next = advanceSession(session, 'next')
data.advanceSession(...)
return { result, nextIndex: next.nextIndex, status: next.status }
```

### buildSessionItems
```
return [...reviewSentences.map(s=>{type:'REVIEW', sentence:s}), {type:'NEW_READING', reading}]
```

## File Organization (Next.js App)
```
app/
  layout.tsx                  # global providers (ClerkProvider, Sentry, Analytics)
  globals.css                 # Tailwind styles, fonts, tokens
  (public)/
    page.tsx                  # placeholder landing
  (auth)/
    sign-in/[[...index]]/page.tsx
    sign-up/[[...index]]/page.tsx
  (app)/
    dashboard/page.tsx        # server component; fetch progress, content summary
    session/[sessionId]/page.tsx  # RSC + client components
  summary/[sessionId]/page.tsx
lib/
  data/
    adapter.ts                # interface + factory
    convex.ts                 # Convex implementation
    neon.ts                   # Neon/Drizzle implementation
    types.ts
  ai/
    gradeTranslation.ts
  session/
    builder.ts
    advance.ts
  logging.ts                  # pino-lite/console structured logger
  metrics.ts                  # hooks to Vercel analytics/custom events
components/
  ui/Button.tsx
  ui/LatinText.tsx
  ui/ProgressBar.tsx
  layout/Shell.tsx
  session/ReviewStep.tsx
  session/ReadingStep.tsx
  session/SummaryCard.tsx
  dashboard/Hero.tsx
  dashboard/Stats.tsx
proxy.ts                      # optional request interception (Next16)
convex/                       # if Convex chosen (schema + functions)
db/                           # if Neon chosen (drizzle schema + migrations)
tests/
  unit/
  integration/
  e2e/
```

## Integration Points
- **Clerk**: `middleware.ts` protects `(app)` routes; use `auth()` in server actions; require `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
- **Gemini**: env `GEMINI_API_KEY`; Node runtime route handler; keep secrets server-side.
- **Convex**: `CONVEX_DEPLOYMENT`, `CONVEX_AUTH_URL`; functions for progress/session/attempts/content; sole datastore.
- **Observability**: Sentry DSN env; Vercel Analytics/Speed Insights imports; structured logs with requestId; source maps in build.
- **Assets**: Vercel Blob optional hook if we add media (not in MVP).

## State Management
- Server source of truth: sessions/progress/content.
- Client state: current in-page status (loading/grading result) via React state; no global client store.
- Cache: RSC fetches with `revalidate` short for dashboard; session routes use `no-store` to avoid stale pointers.
- Concurrency: `advanceSession` uses atomic update in data layer (Convex mutation or SQL transaction) to prevent double-advance.

## Error Handling Strategy
- Validation errors → 400; Auth errors → 401/403; Not found → 404; Unexpected → 500 with generic message.
- Gemini failures return PARTIAL with reference; log warning + metric.
- Log structure: `{level, msg, userId?, sessionId?, requestId, err}`; redact PII.

## Testing Strategy
- Unit: `lib/session` builder/advance logic; `lib/ai` parsing/guardrails (mock Gemini).
- Integration: route handlers/server actions with data adapter (Convex local or test DB).
- E2E: Playwright—auth flow, session completion, resume after refresh, Gemini mock.
- Coverage targets: 80% patch; 90% for session and grading logic.
- CI: lint + typecheck + test + build; Vercel preview deploy.

## Performance & Security Notes
- Performance budgets: dashboard TTFB <200ms; grading p95 <4s; keep client bundles lean (RSC heavy).
- Security: Clerk middleware; server-only secrets; length limits on inputs; rate-limit grading per user/session (Convex mutation or middleware throttle).
- Observability: dashboards for error rate, grading latency, session completion; alerts on 5xx >1% or Gemini error spike; cost/quota alerts for Gemini/Convex/Neon.

## Alternative Architectures Considered
| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Convex + Clerk + Node route handlers | Fastest dev, strong TS, realtime, minimal ops | Vendor lock, pricing | **Chosen** |
| Neon + Drizzle + Clerk | SQL flexibility, portability | More plumbing, pooling complexity, slower to ship | Dropped for MVP |
| Supabase | All-in-one | Not Vercel-native per brief, extra surface | Rejected |

## ADR
ADR optional later if reconsidering datastore; current choice is Convex only.

## Open Questions / Assumptions
- Confirm Convex as default; if Neon needed, clarify schema requirements.
- OAuth providers beyond email/Google?
- Regions/latency targets (assumed US/EU default).
- Compliance constraints (assumed standard SaaS, no minors).
- Budget ceilings for Sentry/Convex/Gemini.
