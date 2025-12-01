# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Caesar in a Year is a Latin learning app designed to help users read Caesar's *De Bello Gallico* in one year. Built with React 19, TypeScript, Vite, and Gemini AI for translation grading.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build
npm run preview      # Preview production build
```

## Environment

Set `GEMINI_API_KEY` in `.env.local` for AI-powered translation grading.

## Architecture

### Session Flow
`App.tsx` manages a simple state machine with three views:
1. **DASHBOARD** → User stats, "Continue Journey" button
2. **SESSION** → Queue of `SessionItem[]` (reviews + new reading)
3. **SUMMARY** → Completion screen

Sessions build a queue mixing review sentences with new readings, processed sequentially.

### Core Types (`types.ts`)
- `Sentence` — Latin text with reference translation for review drills
- `ReadingPassage` — Multi-sentence passage with glossary and gist question
- `SessionItem` — Polymorphic union (REVIEW or NEW_READING)
- `GradingResult` — AI response with status (CORRECT/PARTIAL/INCORRECT) + feedback

### AI Integration (`services/geminiService.ts`)
Single function `gradeTranslation()` calls Gemini 2.5 Flash with structured JSON output. Uses `@google/genai` SDK with schema-constrained responses.

### Component Patterns
- `LatinText` — Dual-language display component (shows Latin with English hover/fallback)
- `Button` — Accepts `labelLatin`/`labelEnglish` props for bilingual UI
- `ReviewStep` — Translation input → AI grading → feedback display
- `ReadingStep` — Interactive glossary (click words) → comprehension question

### Data Layer
Currently uses static mock data in `constants.ts`. Future: CMS/database integration.

### Styling
Tailwind CSS with custom colors (`roman-*`, `pompeii-*`). Animations: `animate-fade-in`, `animate-bounce-in`.
