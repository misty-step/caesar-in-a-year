# CLAUDE.md

**Note**: This project uses [bd (beads)](https://github.com/steveyegge/beads)
for issue tracking. Use `bd` commands instead of markdown TODOs.
See AGENTS.md for workflow details.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Caesar in a Year is a Latin learning app designed to help users read Caesar's *De Bello Gallico* in one year. Built with Next.js 16, React 19, TypeScript, Clerk auth, and Gemini AI for translation grading.

## Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Start dev server on http://localhost:3000
pnpm build           # Production build
pnpm start           # Run production server
```

## Environment

Set in `.env.local`:
- `GEMINI_API_KEY` — AI-powered translation grading
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Authentication

## Architecture

### Session Flow
App Router manages views via route segments:
1. `/dashboard` → User stats, "Start Session" button
2. `/session/[id]` → Queue of `SessionItem[]` (reviews + new reading)
3. `/summary/[id]` → Completion screen

### Core Types (`types.ts`)
- `Sentence` — Latin text with reference translation for review drills
- `ReadingPassage` — Multi-sentence passage with glossary and gist question
- `SessionItem` — Polymorphic union (REVIEW or NEW_READING)
- `GradingResult` — AI response with status (CORRECT/PARTIAL/INCORRECT) + feedback

### AI Integration (`lib/ai/gradeTranslation.ts`)
Deep module: `gradeTranslation()` calls Gemini 2.5 Flash with structured JSON output. Uses `@google/genai` SDK. Handles circuit breaking, retry with backoff, timeouts, and graceful fallback internally.

### Component Patterns
- `LatinText` — Dual-language display (Latin with English hover/fallback)
- `Button` — Bilingual UI with `labelLatin`/`labelEnglish` props
- `ReviewStep` — Translation input → AI grading → feedback
- `ReadingStep` — Interactive glossary → comprehension question

### Data Layer
In-memory adapter (`lib/data/adapter.ts`) with Convex-ready interface. Future: real persistence.

### Design System (Kinetic Codex)

Two-layer token architecture: primitives (DNA) → semantics (interface).

**Token Reference** (use semantics, never primitives):
```
Backgrounds:     bg-background, bg-surface, bg-surface-inverted
Borders:         border-border, border-border-subtle, border-border-inverted
Text:            text-text-primary, text-text-secondary, text-text-muted, text-text-faint
Accent:          bg-accent, text-accent, hover:bg-accent-hover, bg-accent-faint
Status:          text-success, bg-success-faint, text-warning, bg-warning-faint
Celebration:     text-celebration, bg-celebration-faint (correct answers)
Achievement:     text-achievement (XP/mastery)
```

**Motion**:
- `duration-fast` (150ms), `duration-normal` (300ms)
- `ease-ink` (ink-flow easing), `ease-spring` (playful bounce)
- `animate-fade-in`, `animate-bounce-in`, `animate-stamp`

**Component Patterns**:
- Use `cn()` from `@/lib/design` for class composition
- Use CVA components (Button, Card, ProgressBar) with variant props
- Always `min-h-dvh` (not `min-h-screen`) for mobile viewport
- Use `size-X` for square elements

**Lint**:
```bash
./scripts/lint-tokens.sh  # Check for raw color class violations
```

**Files**:
- `app/globals.css` — Token definitions, base styles
- `lib/design/index.ts` — cn() utility, tokens export
- `components/UI/` — CVA-based primitives (Button, Card, etc.)
