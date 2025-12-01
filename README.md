# Caesar in a Year

Daily guided Latin sessions that train you to read *De Bello Gallico* in context, not just memorize forms. The app uses Next.js 16 (App Router), Clerk auth, and Gemini 2.5 for grading.

## Quickstart

**Prereqs**
- Node `>= 20.9.0`
- `pnpm` (preferred)

**Install & run**

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`.

## Environment

Create `.env.local` with at least:

```bash
GEMINI_API_KEY=your-gemini-key
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

- Gemini grading uses `GEMINI_API_KEY` via `lib/ai/gradeTranslation.ts` (model: `gemini-2.5-flash`).
- Clerk protects the `(app)` segment via `middleware.ts`; unauthenticated users are redirected to `/sign-in`.

## App Flow

- `/dashboard` (authed): shows current progress and CTA to start today’s session.
- `/session/new`: builds a session from the current content seed and redirects to `/session/[sessionId]`.
- `/session/[sessionId]`: renders a queue of 3 review items + 1 reading passage.
  - Review steps call `/api/grade` with your translation and show Gemini feedback.
  - Reading step grades your gist answer against a reference summary.
- `/summary/[sessionId]`: lightweight completion view with session stats and links back to dashboard or a new session.

Under the hood:
- `lib/data/adapter.ts` currently uses an in-memory adapter for sessions, attempts, and progress (Convex-ready interface).
- `lib/session` builds/advances the session queue.
- `app/api/grade` + `app/api/session/advance` handle grading and pointer updates server-side.

## Scripts

- `pnpm dev` – run dev server.
- `pnpm build` / `pnpm start` – production build and serve.
- `pnpm lint` – ESLint (Next config).
- `pnpm vitest` – run unit tests (lib + selected app routes).

Run lint and tests before pushing. The in-memory adapter is for local development only; swap in a real Convex/DB adapter before production.
