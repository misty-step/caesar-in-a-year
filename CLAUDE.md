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

### Styling
Tailwind CSS with custom colors (`roman-*`, `pompeii-*`). Animations: `animate-fade-in`, `animate-bounce-in`.
