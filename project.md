# Project: Caesar in a Year

## Vision
The best Latin learning app for reading Caesar's *De Bello Gallico* in one year.

**North Star:** Users who stick with the program actually read Latin fluently. The learning loop is so good—AI grading so accurate, spaced repetition so effective, daily habit so sticky—that completion rates far exceed other language learning apps.

**Target User:** Self-motivated adults who want to read classical Latin but failed with traditional textbooks or apps. They want to read Caesar, not just conjugate verbs.

**Current Focus:** Everything — core loop excellence, launch readiness, and production hardening.

**Key Differentiators:**
- AI-powered translation grading with meaningful feedback (not just right/wrong)
- FSRS spaced repetition tuned specifically for Latin vocabulary retention
- Focused scope: one text, one year, clear progress
- Simple, distraction-free interface

## Domain Glossary

Terms agents must understand to work in this codebase.

| Term | Definition |
|------|-----------|
| `Session` | A daily learning block containing a queue of SessionItems |
| `SessionItem` | Polymorphic union: either `REVIEW` (drill a known sentence) or `NEW_READING` (encounter new passage) |
| `FSRS` | Free Spaced Repetition Scheduler — algorithm determining when to resurface sentences for review |
| `ReviewStep` | UI component for translation input → AI grading → feedback flow |
| `ReadingStep` | UI component for interactive glossary → comprehension question flow |
| `GradingResult` | AI response with status (CORRECT/PARTIAL/INCORRECT) and feedback text |
| `MemoryAdapter` | In-memory data layer (Convex-ready interface) — stores user progress, session state |
| `ReadingPassage` | Multi-sentence passage with glossary and gist question |
| `Sentence` | Latin text with reference translation, used in review drills |
| `hasAccess()` | Billing gate — returns true if user has active trial or paid subscription |

## Active Focus

- **Milestone:** Now: Current Sprint — launch readiness and foundation work
- **Key Issues:** #35 (launch announcement), #30 (social proof), #28 (security), #17 (security)
- **Theme:** Ship-ready: observability hardened, security gaps closed, learning loop polished

## Quality Bar

What "done" means beyond "tests pass."

- [ ] AI grading gives feedback a student could actually learn from (not generic)
- [ ] Sessions feel snappy — no perceptible latency on grade submission
- [ ] No broken states: network errors, auth lapses, and billing transitions handled gracefully
- [ ] Mobile-friendly: usable one-handed on a phone
- [ ] Billing transitions (trial → paid, cancellation, past-due) never lose user data

## Patterns to Follow

### Deep Module Pattern
```typescript
// Prefer: one function that handles all complexity internally
// Bad: exposing circuit-breaker, retry, timeout as separate concerns
// Good: gradeTranslation() handles all of that
const result = await gradeTranslation(sentence, userTranslation, userId);
```

### Bilingual UI Props
```typescript
// All interactive components support Latin labels
<Button labelLatin="Responde" labelEnglish="Submit" />
```

### Semantic Token Usage
```typescript
// Always semantic tokens, never raw Tailwind colors
className="text-text-primary bg-surface border-border"
// Never: className="text-gray-900 bg-white border-gray-200"
```

## Lessons Learned

| Decision | Outcome | Lesson |
|----------|---------|--------|
| In-memory adapter (MemoryAdapter) | Works for now, Convex interface ready | Don't wire real persistence until the loop is proven |
| Gemini for grading | Better contextual feedback than rule-based | Model choice matters — structured JSON output via `@google/genai` SDK |

---
*Last updated: 2026-02-23*
*Updated during: /groom session*
