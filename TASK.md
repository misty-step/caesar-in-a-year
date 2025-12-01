## Executive Summary
- Build a Next.js 16 LTS (App Router + Turbopack default) rewrite of the current Vite React app, deployed to Vercel, with Clerk auth and AI-powered grading via Gemini.
- Persist user progress/session data in Convex (single datastore; no fallback in MVP).
- Use Vercel-native services (Edge/Functions, Blob if assets appear, Analytics, Speed Insights); ship a production-ready vertical slice of the existing dashboard → session → summary flow.
- Success metrics: (1) Auth success rate >95%; (2) p75 TTFB <200ms on dashboard; (3) Grading success (non-500) >99%; (4) Daily active learners completing ≥1 session/day baseline.

## User Context & Outcomes
- Users: adult self-learners of Latin; need quick daily sessions with clear progress + trustworthy grading.
- Outcomes: frictionless sign-in, instant resume of daily queue, fast grading feedback, retained progress across devices.
- Impact: time-to-first-session <30s after landing; session completion without retries; bilingual UX preserved.

## Requirements
### Functional
- Auth via Clerk (email + OAuth); anonymous not supported.
- Dashboard page: shows day/streak/xp/unlockedPhase, “Continue Journey” CTA; data pulled from backend.
- Session page: queue of items (review sentences + new reading); progress bar; per-item grading using Gemini; handles loading/error states; summary screen mirrors current UX.
- Data persistence: store user profile, session queue, attempts, progress, and content references (review sentences, readings). Content initially seeded from current constants.
- API/Edge functions: server action to call Gemini with schema-constrained JSON, retries + user-facing errors; secure env handling.
### Non-functional
- Runtime/platform: Next.js 16 requires Node.js ≥20.9; Turbopack is default (no flags); React 19.2; cacheComponents/Partial Pre-Rendering available.
- Performance: p75 TTFB <200ms (dashboard) from Vercel region autodetected; grading latency budget <4s p95.
- Reliability: graceful Gemini failure path; idempotent session completion.
- Security: Clerk-protected routes; server-side data access only; no PII logs; secrets via Vercel env.
- Accessibility: WCAG AA; keyboardable components; focus states; language tagging for Latin text.
- Internationalization: retain Latin/English toggles; avoid layout shift during label cycling.
- ### Infrastructure / Quality Gates
- Tooling: pnpm, TypeScript strict, ESLint/Biome (no `next lint` in Next16), unit + integration tests; target 80% patch coverage.
- CI: Vercel deploy previews + lint/test workflow.
- Observability: Vercel Analytics + Speed Insights; error tracking (Sentry) with source maps; structured logging on server handlers; optional Next.js Devtools MCP for debugging.
- ADR Required: tech stack choice (Convex vs Neon) + hosting patterns (Edge vs Node runtime).

## Architecture Decision
**Selected**: Next.js 16 App Router on Vercel (Turbopack default, cacheComponents ready, proxy.ts), Clerk for auth, Convex as the sole data layer (hosted, realtime, TypeScript-first), Vercel Functions (Node runtime) for Gemini grading, Vercel Analytics for observability.  
**Why**: minimal infra, LTS support with Turbopack stability, cache-friendly data loading, smallest interface surface; Convex hides DB ops; Node runtime keeps Clerk + Gemini happy.

### Alternatives (scored: User Value 40 / Simplicity 30 / Explicitness 20 / Risk 10; higher better)
| Option | Score | Notes |
| --- | --- | --- |
| Convex + Clerk + Vercel Functions | 8.8 | Deep API, schema + auth integration, zero SQL; vendor lock acceptable; fastest deliver. |
| Neon Postgres + Drizzle + Clerk + Vercel Functions | 7.5 | SQL flexibility, clearer portability; slower to ship, needs migrations + pooling. |
| Supabase (not requested) | 6.5 | Full-stack features but adds non-Vercel infra; rejected per brief. |

Module boundaries:  
- `app/(public)/` for marketing/landing; `app/(auth)/` for Clerk routes; `app/(app)/dashboard`, `app/(app)/session/[id]`, `app/(app)/summary`.  
- `lib/data` hides backend client (Convex or Neon) behind thin interface returning domain models.  
- `lib/ai/gradeTranslation` server-only; interface: `gradeTranslation({latin, userTranslation, reference, context}) → GradingResult`.  
- `components/ui` keep LatinText/Button patterns; avoid leaking data layer details into UI.

## Data & API Contracts
- User: `{id, email, displayName, createdAt}` from Clerk.
- Progress: `{userId, day:number, streak:number, totalXp:number, unlockedPhase:number}`.
- Content: `Sentence {id, latin, referenceTranslation, context}`; `ReadingPassage {id, title, lines[], glossary, gistQuestion, referenceGist}`.
- Session: `{id, userId, items: SessionItem[], currentIndex, status:'active'|'complete', startedAt, completedAt?}`.
- Attempt: `{sessionId, itemId, type, userInput, gradingResult, createdAt}`.
- API surface: server action `POST /api/grade` (Node runtime) accepts `{itemId, userInput}` and resolves with `GradingResult`; server action `POST /api/session/advance` updates progress atomically; adopt `proxy.ts` naming for request interception if needed.
- Gemini: use `models/gemini-2.5-flash` with JSON Schema structured outputs (stable as of Nov 2025); keep deprecation schedule in mind.

## Implementation Phases
1) MVP: scaffold Next.js app, Clerk auth, seed content, render dashboard/session/summary with static data; stub grading (mock).  
2) Data/AI: integrate Convex, persist sessions/progress, wire Gemini via server action/route handler with retries + guardrails (JSON Schema structured outputs).  
3) Hardening: add analytics, error tracking, a11y passes, tests, loading/error states, deploy previews.  
4) Future: spaced repetition scheduling, CMS-backed content, offline-friendly cache, mobile polish.

## Testing & Observability
- Tests: unit (lib/data adapters, ai guardrail), integration (route handlers, session flow), e2e (Playwright) for auth + session happy path; contract tests for grading schema.  
- Observability: Vercel Analytics + Speed Insights; Sentry for server/client errors with source maps, PII redaction; structured logs with request IDs.  
- Performance: monitor Web Vitals, grading latency; cost/quota alerts on Gemini + Convex/Neon.  
- Deployment: Vercel preview per PR; protected main; rollback via previous deployment.

## Risks & Mitigations
- Gemini quota/latency → add circuit breaker + graceful fallback using reference translation.  
- Vendor lock (Convex) → abstraction via `lib/data`, documented swap path; Neon alternative kept in ADR.  
- Auth edge cases (Clerk session in Edge) → prefer Node runtime for grading route or ensure Clerk Edge middleware configured.  
- No tests currently → add baseline coverage in phase 1/2 to prevent regressions.

## Open Questions / Assumptions
- Q1: Prefer Convex or Neon? (assume Convex unless SQL mandated).  
- Q2: Any compliance/PII constraints? (assume standard SaaS, no minors).  
- Q3: Target regions/locales? (assume US/EU; choose closest Vercel region).  
- Q4: Are additional providers (Google/Microsoft OAuth) required? (assume email + Google).  
- Q5: Content management plan—static seed vs CMS? (assume static seed now).  
- Q6: Budget for Sentry/Convex tiers? (assume free/entry tiers acceptable).  
- Owner to confirm before build; otherwise proceed with stated assumptions.
