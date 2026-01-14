# ADR 0010: History-Aware AI Grading with Escalation

## Status
Accepted

## Context
Users often make the same mistake repeatedly. Generic feedback doesn't address patterns. AI grading should adapt based on prior attempts.

**Observation:** A first attempt with a grammar error needs a brief hint. A fifth attempt with the same error needs thorough explanation with memory aids.

**Alternatives considered:**
1. Stateless grading - same feedback regardless of history
2. Client-side attempt counting - loses history across sessions
3. Server-side history with prompt escalation - adapts feedback depth

## Decision
Pass `attemptHistory` to grading function. Prompt includes escalation instructions:

```typescript
function getEscalationLevel(attemptCount: number): string {
  if (attemptCount === 0) return "";
  if (attemptCount === 1) return "\n-> 2nd attempt: reference prior mistake, be slightly more detailed.";
  return `\n-> Attempt #${attemptCount + 1}: thorough explanations, step-by-step grammar, memory aids, be encouraging.`;
}
```

History section in prompt:
```
HISTORY (3 prior attempts):
3. Dec 15: INCORRECT [grammar, vocabulary]
2. Dec 14: PARTIAL [word_order]
1. Dec 13: INCORRECT [grammar]
```

## Consequences

**Good:**
- Feedback improves with repeated attempts
- AI can reference specific prior error patterns
- More encouraging tone for struggling learners
- Error types preserved for pattern detection

**Bad:**
- Longer prompts with history (more tokens, slightly slower)
- History lookup adds database query
- Escalation logic is heuristic, not validated

**Why store errorTypes in attempts?**
Enables pattern detection without re-parsing grading results. Query like "show me sentences where user repeatedly makes grammar errors" becomes trivial.

**Future consideration:** Could add pattern detection to surface "You keep making accusative errors - here's a focused drill."
