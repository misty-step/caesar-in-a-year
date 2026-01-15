# ADR 0003: AI Grading Resilience Architecture

## Status
Accepted

## Context
AI grading via Gemini is the core feature but introduces external dependency risk. Users should never be blocked by AI failures. The grading function is called on every translation attempt.

**Failure modes:**
- API key missing
- Network timeout
- Gemini rate limit
- Service outage
- Malformed response

**Alternatives considered:**
1. No fallback - bad UX, users stuck
2. Fallback to string matching - too brittle for Latin translation
3. Fallback to PARTIAL with reference - honest about limitation, still useful

## Decision
Deep module pattern: `gradeTranslation()` and `gradeWithAI()` handle all resilience internally. Caller gets a result, always.

**Resilience stack:**
1. **Circuit breaker** (5 consecutive failures opens circuit for 60s)
2. **Retry with exponential backoff** (3 attempts, 300ms base backoff)
3. **Timeout** (60s generous timeout)
4. **Graceful fallback** (PARTIAL status with reference translation)

Fallback message: "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually."

## Consequences

**Good:**
- Users never blocked by AI failures
- Transparent degradation (user knows AI is unavailable)
- Circuit breaker prevents thundering herd on outages
- No retry storms during rate limiting

**Bad:**
- PARTIAL fallback may frustrate users expecting detailed feedback
- Circuit breaker state is per-process (not shared across Vercel functions)
- 60s timeout is generous - could tighten after measuring p99

**Why PARTIAL not CORRECT/INCORRECT?**
PARTIAL is the most honest assessment when we can't grade. It signals "we don't know" without penalizing or rewarding unfairly.
