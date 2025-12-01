## Planning Report
Spec: DESIGN.md (Next.js 16 / Clerk / Convex / Gemini)

Tasks Generated: 12  
Total Estimate: ~12h  
Critical Path: ~7h (Tasks 1 → 3 → 4 → 7 → 8 → 9)

### Task Summary
| Phase | Tasks | Estimate | Dependencies |
| --- | --- | --- | --- |
| Setup | 2 | 1.5h | None |
| Core | 6 | 6.5h | Setup/Auth/Data |
| Observability/Infra | 2 | 2h | Core |
| Quality | 2 | 2h | Core |

### TODO

- [x] 1) Scaffold Next.js 16 app with App Router & Turbopack  
  Files: `package.json`, `app/layout.tsx`, `app/page.tsx`, `tsconfig.json`, `next.config.js`, `proxy.ts`, `globals.css`  
  Goal: Replace Vite scaffold with Next 16 baseline (Node ≥20.9, React 19.2).  
  Approach: `pnpm dlx create-next-app@latest --ts --app --turbo --no-tailwind` into temp, copy needed configs; enable `experimental.cacheComponents` if stable; add roman/pompeii palette + fonts in `globals.css`; remove CDN tailwind usage.  
  Success: `pnpm dev` serves default page at `/`; build succeeds.  
  Tests: none (build).  
  Estimate: 45m.

- [x] 2) Add Tailwind config + design tokens  
  Files: `tailwind.config.ts`, `postcss.config.js`, `globals.css`  
  Goal: Recreate existing roman/pompeii palette and fonts in Next Tailwind pipeline.  
  Approach: init Tailwind, port colors/font families, base body styles; ensure `content` globs include `app/**`.  
  Success: Tokens available in dev build; no CDN tailwind references remain.  
  Tests: visual smoke (manual).  
  Estimate: 30m.  
  depends: Task 1.

- [x] 3) Integrate Clerk auth (App Router)  
  Files: `app/layout.tsx`, `middleware.ts`, `app/(auth)/sign-in/[[...index]]/page.tsx`, `app/(auth)/sign-up/[[...index]]/page.tsx`, `.env.example`  
  Goal: Protect `(app)` segment with Clerk; provide sign-in/up routes.  
  Approach: wrap layout with `ClerkProvider`; add `auth()` in protected loaders; configure middleware matcher; document env keys.  
  Success: Unauthed user redirected to sign-in; authed can access dashboard placeholder.  
  Tests: Playwright stub (optional later), manual.  
  Estimate: 1h.  
  depends: Task 1.

- [x] 4) Implement data adapter layer (Convex primary, Neon fallback scaffold)  
  Files: `lib/data/adapter.ts`, `lib/data/convex.ts`, `lib/data/neon.ts`, `lib/data/types.ts`, `convex/schema.ts` (if using Convex), `db/schema.ts` (stub)  
  Goal: Provide `DataAdapter` interface + Convex implementation for progress/session/content; stub Neon implementation to satisfy interface.  
  Approach: define types (Progress, Session, Attempt, Content); implement Convex mutations/queries; simple seed for content; keep Neon file throwing `NotImplemented` but typed.  
  Success: `DataAdapter` factory returns Convex adapter; typecheck passes; Convex functions compile locally.  
  Tests: unit for adapter interface shape (tsd/ts checks); optional Convex function tests if available.  
  Estimate: 1.5h.  
  depends: Task 1.

- [x] 5) Session orchestration module  
  Files: `lib/session/builder.ts`, `lib/session/advance.ts`, `lib/session/__tests__/session.test.ts`  
  Goal: Build session queues and advance logic per spec.  
  Approach: implement pure functions with current 3 reviews + 1 reading; idempotent completion; write unit tests covering advance edges.  
  Success: Tests pass; functions exported for reuse.  
  Tests: unit (happy path, final advance, over-advance no-op).  
  Estimate: 45m.  
  depends: Task 4.

- [x] 6) Gemini grading service (server-only)
  Files: `lib/ai/gradeTranslation.ts`, `lib/ai/__tests__/gradeTranslation.test.ts` (mock SDK)
  Goal: Server util calling `models/gemini-2.5-flash` with JSON Schema; retries + timeout + fallback.
  Approach: input guards, circuit breaker placeholder, schema definition, parse JSON; dependency-inject API key via env.
  Success: Unit tests pass (mocked); handles failure returning PARTIAL.
  Tests: unit with mocked SDK; edge case for timeout.
  Estimate: 1h.
  depends: Task 1.
- [x] 7) API routes / server actions for grading and session advance  
  Files: `app/(app)/session/[sessionId]/actions.ts`, `app/api/grade/route.ts` (Node runtime), `app/api/session/advance/route.ts`  
  Goal: Wire UI to data adapter + grading service; auth enforced.  
  Approach: server actions call `data.getSession`, `gradeTranslation`, `recordAttempt`, `advanceSession`; return next index/result.  
  Success: Requests succeed authed; unauthorized → 401; bad input → 400; stored attempt recorded.  
  Tests: integration (route handler with mocked data adapter/grading).  
  Estimate: 1.25h.  
  depends: Tasks 3,4,5,6.

- [x] 8) Dashboard page (server component)  
  Files: `app/(app)/dashboard/page.tsx`, `components/dashboard/Hero.tsx`, `components/dashboard/Stats.tsx`  
  Goal: Render progress and CTA using server-fetched data.  
  Approach: fetch via `data.getUserProgress` and `getContent` (summary only); reuse roman/pompeii styling; CTA links/creates session.  
  Success: Page renders for authed users; handles missing progress with defaults.  
  Tests: React Testing Library for rendering fallback; typecheck.  
  Estimate: 45m.  
  depends: Tasks 3,4,5.

- [x] 9) Session + Summary pages with UI components  
  Files: `app/(app)/session/[sessionId]/page.tsx`, `app/(app)/summary/[sessionId]/page.tsx`, `components/session/ReviewStep.tsx`, `components/session/ReadingStep.tsx`, `components/ui/Button.tsx`, `components/ui/LatinText.tsx`, `components/ui/ProgressBar.tsx`, `components/session/SummaryCard.tsx`  
  Goal: Port existing UX to Next, hook to server actions, preserve bilingual interactions.  
  Approach: convert components to client where needed; connect actions for grading/advance; handle loading/error states; add lang attributes/accessibility.  
  Success: User can run full session, see feedback, reach summary; refresh keeps position.  
  Tests: integration rendering with mocked actions; minimal Playwright happy path (optional in Task 12).  
  Estimate: 1.5h.  
  depends: Tasks 5,6,7.

- [ ] 10) Observability: Sentry + Vercel Analytics/Speed Insights + structured logging  
  Files: `app/layout.tsx`, `sentry.client.config.ts`, `sentry.server.config.ts`, `lib/logging.ts`, `.env.example`  
  Goal: Enable error tracking and analytics; add requestId logging helper.  
  Approach: init Sentry per Next 16 guide; wrap server handlers with logger; avoid PII; add Speed Insights/Analytics imports.  
  Success: Build passes; DSN optional; logs structured in handlers.  
  Tests: manual verify build; snapshot log format unit test.  
  Estimate: 45m.  
  depends: Task 7.

- [ ] 11) CI workflow + scripts  
  Files: `.github/workflows/ci.yml`, `package.json` scripts, `lefthook.yml` (if present)  
  Goal: Add lint/typecheck/test/build pipeline; enforce pnpm; set coverage threshold 80% patch.  
  Approach: workflow steps for pnpm install, lint (eslint/biome), test (vitest/jest), build; add env placeholders; add lefthook pre-commit for lint+typecheck.  
  Success: CI passes locally; hooks run lint/typecheck.  
  Tests: run workflow locally (act optional); run hooks.  
  Estimate: 1h.  
  depends: Tasks 1,5,6,7.

- [ ] 12) E2E happy path (Playwright)  
  Files: `e2e/session.spec.ts`, `playwright.config.ts`  
  Goal: Cover auth → dashboard → session → summary with mocked Gemini/data adapter.  
  Approach: mock network for /api/grade and data fetch; use test Clerk user; run headless.  
  Success: Test passes in CI; documents how to run.  
  Tests: the spec itself.  
  Estimate: 1h.  
  depends: Tasks 3,7,9.

### Critical Path
1 → 3 → 4 → 7 → 8 → 9 → 11 (deployable); 10 in parallel after 7; 12 parallel after 9.

### Risks
- Convex vs Neon decision pending ADR — could alter Task 4/7 details; mitigation: keep adapter interface stable.  
- Gemini quota/latency — covered by fallback in Task 6; still monitor.  
- Auth in Node runtime only — ensure no Edge deployment for grading routes.  
- CI time with Playwright — consider headed disable in CI; keep mocks fast.

### Backlog (not now)
- CMS-backed content; spaced repetition scheduler; offline cache; Vercel Blob assets.
