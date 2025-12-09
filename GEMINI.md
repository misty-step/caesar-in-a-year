# Caesar in a Year - Project Context

## Project Overview
**Caesar in a Year** is a web application designed to help users read Julius Caesar's *De Bello Gallico* in its original Latin over the course of a year. It combines daily guided sessions with spaced repetition (SRS) and AI-powered feedback.

**Tech Stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS (Custom `roman` and `pompeii` themes)
- **Auth:** Clerk (`@clerk/nextjs`)
- **AI:** Gemini 2.5 Flash (via `@google/genai`) for grading translations
- **Backend/Data:** Convex (Schema defined, currently using in-memory adapter in dev)
- **Spaced Repetition:** `ts-fsrs` implementation
- **Corpus Processing:** Python scripts

## Architecture
- **`app/`**: Next.js App Router.
  - `(app)/`: Protected routes (`dashboard`, `session`, `summary`).
  - `(auth)/`: Clerk sign-in/sign-up.
  - `api/`: Server-side API routes for grading and session advancement.
- **`components/`**: React UI components.
  - `UI/`: Reusable primitives (`Button`, `LatinText`).
  - `Session/`: specialized session steps (`ReviewStep`, `ReadingStep`).
- **`lib/`**: Core domain logic (Keep pure/testable).
  - `ai/`: Gemini integration (`gradeTranslation.ts`).
  - `data/`: Data adapters and types.
  - `session/`: Session queue management.
  - `srs/`: FSRS algorithm configuration.
- **`convex/`**: Database schema and server functions.
- **`scripts/`**: Python corpus processing and sync utilities.

## Key Workflows
1.  **Session Flow**:
    -   User starts at `/dashboard`.
    -   `/session/new` builds a session (3 reviews + 1 new reading).
    -   `/session/[id]` guides user through items.
    -   Reviews are graded via `/api/grade` (calling Gemini).
    -   `/summary/[id]` shows results.
2.  **Corpus Pipeline**:
    -   Python scripts fetch text from Perseus/MIT Classics.
    -   Processed into JSON (`content/`).
    -   Synced to Convex.

## Commands

### Development
```bash
pnpm install            # Install dependencies
pnpm dev                # Start dev server (http://localhost:3000)
pnpm lint               # Run ESLint
pnpm vitest             # Run unit tests
```

### Build
```bash
pnpm build              # Build for production
pnpm start              # Start production server
```

### Corpus Tools
*Requires Python 3.10+ venv in `.venv/`*
```bash
# Process specific chapter
pnpm corpus:process -- --book 1 --chapter 1

# Sync to Convex
pnpm corpus:sync
```

## Conventions
- **Styling**: Use `roman-*` (neutrals) and `pompeii-*` (accents) colors from Tailwind config.
- **Components**: Use `LatinText` for bilingual text (Latin with English hover/cycle).
- **Testing**: Write tests in `__tests__` directories alongside code. Mock external services (AI, DB).
- **Environment**: Secrets in `.env.local` (`GEMINI_API_KEY`, `CLERK_SECRET_KEY`, etc.).
- **Commits**: Follow Conventional Commits (`feat:`, `fix:`, `chore:`).

## Data Model (Convex)
- **`sentences`**: The corpus content.
- **`userProgress`**: User stats (streak, XP).
- **`sentenceReviews`**: FSRS card state per user/sentence.
