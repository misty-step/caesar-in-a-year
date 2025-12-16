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
- `app/api/grade` handles grading server-side; session advance is internal to the grading flow.

## Scripts

- `pnpm dev` – run dev server.
- `pnpm build` / `pnpm start` – production build and serve.
- `pnpm lint` – ESLint (Next config).
- `pnpm vitest` – run unit tests (lib + selected app routes).

Run lint and tests before pushing. The in-memory adapter is for local development only; swap in a real Convex/DB adapter before production.

## Corpus Pipeline

Process Caesar's *De Bello Gallico* into structured sentences for the app.

**Prerequisites**: Python 3.10+ with venv at `.venv/`

```bash
# Set up Python environment (one-time)
python3 -m venv .venv
.venv/bin/pip install requests beautifulsoup4 lxml

# Process a single chapter
pnpm corpus:process                           # Book 1, Chapter 1
pnpm corpus:process -- --book 1 --chapter 5   # Specific chapter
pnpm corpus:process -- --book 7 --chapter 1   # Different book

# Process all of Book 1
for ch in {1..52}; do
  .venv/bin/python scripts/process-corpus.py --book 1 --chapter $ch --output "content/bg-1-$ch.json"
done

# Validate output
.venv/bin/python scripts/process-corpus.py --validate-only content/corpus.json

# Sync to Convex (needs CONVEX_URL)
pnpm corpus:sync -- --dry-run    # Validate first
pnpm corpus:sync                 # Actually sync
```

**Text Sources** (public domain):
- Latin: Caesar's *De Bello Gallico* (~50 BCE), digitized by [Perseus Digital Library](http://www.perseus.tufts.edu)
- English: W. A. McDevitte & W. S. Bohn translation (1869), via [MIT Internet Classics Archive](https://classics.mit.edu)

## Architecture

### Philosophy

**Trust the LLM.** Gemini grades translations for meaning, not grammar rules. Flexible wording, strict meaning.

**Trust the corpus.** Caesar's text IS the curriculum. Difficulty computed from word count, clause depth, vocabulary rarity.

**Trust FSRS.** Spaced repetition handles personalization (timing). Content selection is deterministic by difficulty level.

### Core Loop

```
Corpus (static) → Difficulty Filter (user level) → Session Builder → FSRS Scheduling
```

### Data Model

- **Sentence**: Latin text with reference translation, difficulty score, book/chapter
- **SentenceReview**: FSRS state per user per sentence (stability, next review date)
- **UserProgress**: Level, streak, XP
- **Session**: Queue of review items + new reading passage

### Key Modules

| Module | Purpose |
|--------|---------|
| `lib/srs/fsrs.ts` | FSRS wrapper for spaced repetition |
| `lib/ai/gradeTranslation.ts` | Gemini grading with JSON schema |
| `lib/session/builder.ts` | Session construction from due reviews + new content |
| `lib/data/convexAdapter.ts` | Convex persistence layer |
| `convex/reviews.ts` | FSRS state mutations |

See `BACKLOG.md` for current work items.
