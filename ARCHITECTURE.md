# Architecture

> Latin learning through spaced repetition + AI grading.

## System at a Glance

```
User → Next.js App Router → Session Builder → Gemini AI Grading
                              ↓
                        Convex (persistence)
                              ↓
                        FSRS (scheduling)
```

**Three concerns, three modules:**
1. **Content**: What Latin sentences exist (corpus, static)
2. **Scheduling**: When to show what (FSRS, deterministic)
3. **Grading**: Is the translation correct (Gemini, probabilistic)

## Module Map

| Module | What it owns | What it doesn't own |
|--------|--------------|---------------------|
| `lib/ai/` | Gemini API calls, grading logic, prompt engineering | UI, persistence, session flow |
| `lib/session/` | Session construction, queue advancement | Grading, persistence, scheduling |
| `lib/srs/` | FSRS wrapper, review scheduling | Content selection, grading |
| `lib/data/` | Type definitions, adapter interface, Convex implementation | Business logic, UI |
| `lib/progress/` | Progress metrics calculation | Persistence, display |
| `convex/` | Database schema, mutations, queries | Business logic (delegates to lib) |
| `components/` | React UI primitives | Business logic, data fetching |
| `app/` | Routing, page composition, API routes | Business logic (delegates to lib) |

## Deep Modules (trust these)

**`lib/ai/gradeTranslation.ts`** - Simple interface: `(latin, reference, userInput) → GradingResult`. Internally handles: retry with backoff, circuit breaking, timeouts, JSON schema validation, graceful fallback. Callers don't see complexity.

**`lib/data/convexAdapter.ts`** - Implements `DataAdapter` interface. All Convex details hidden. Swap adapters without touching business logic.

**`lib/progress/metrics.ts`** - Computes all dashboard metrics in one call. UI components just render slices.

## Shallow Modules (use carefully)

**`lib/session/builder.ts`** - Exposes session construction details. Consider consolidating with advancement logic.

**`components/Session/*`** - Step components have mixed responsibilities (display + state management). Consider extracting state to parent.

## Data Flow

**Session creation:**
```
/session/new (route)
  → getContent() (adapter)
  → buildSession() (lib/session)
  → createSession() (adapter)
  → redirect to /session/[id]
```

**Grading flow:**
```
User submits translation
  → POST /api/grade
  → gradeTranslation() (lib/ai)
  → recordAttempt() (adapter)
  → recordReview() (adapter, updates FSRS state)
  → advanceSession() (adapter)
  → Response with GradingResult
```

## Key Types

```typescript
// The polymorphic session item
type SessionItem =
  | { type: 'REVIEW'; sentence: Sentence }
  | { type: 'NEW_READING'; reading: ReadingPassage }
  | { type: 'VOCAB_DRILL'; vocab: VocabCard }
  | { type: 'PHRASE_DRILL'; phrase: PhraseCard };

// The grading contract
interface GradingResult {
  status: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
  feedback: string;
  correction?: string;
  analysis?: GradingAnalysis;
}

// The adapter interface (swap implementations)
interface DataAdapter {
  getUserProgress(userId: string): Promise<UserProgress | null>;
  getContent(userId: string): Promise<ContentSeed>;
  createSession(userId: string, items: SessionItem[]): Promise<Session>;
  recordReview(userId: string, sentenceId: string, result: GradingResult): Promise<void>;
  // ... see lib/data/types.ts for full interface
}
```

## Entry Points

**Start here when debugging:**
- Session issues: `app/(app)/session/[id]/page.tsx`
- Grading issues: `lib/ai/gradeTranslation.ts`
- Progress issues: `lib/progress/metrics.ts`
- Data issues: `lib/data/convexAdapter.ts`

**Start here when adding features:**
- New session item type: `lib/data/types.ts` (types), `lib/session/builder.ts` (construction), `components/Session/` (UI)
- New metric: `lib/progress/metrics.ts` (calculation), `components/dashboard/` (display)
- New API route: `app/api/` (route), `lib/` (logic)

## State Diagrams

Mermaid diagrams for visual understanding:
- [`docs/architecture/session-flow.md`](docs/architecture/session-flow.md) - Step states, FSRS, streak, circuit breaker
- [`docs/architecture/grading-flow.md`](docs/architecture/grading-flow.md) - AI grading data flow, error paths

## Design Decisions

See [`docs/adr/`](docs/adr/) for architectural decision records (10 ADRs).

Key invariants:
- **All grading happens server-side** (API keys, rate limiting)
- **FSRS state is source of truth for scheduling** (not computed from attempts)
- **Sessions are immutable after creation** (only currentIndex advances)
- **UI uses semantic tokens only** (see CLAUDE.md design system section)
