# ADR 0002: FSRS Three-Rating System for Spaced Repetition

## Status
Accepted

## Context
The app needs spaced repetition scheduling for review sentences. ts-fsrs library provides a proven algorithm (FSRS v4) with four ratings: Again, Hard, Good, Easy.

**Problem:** The app uses AI grading with three outcomes (CORRECT, PARTIAL, INCORRECT). Mapping to four ratings requires a signal for "effortless recall" that AI grading cannot reliably provide.

**Alternatives considered:**
1. Four ratings with Easy mapped to fast correct answers - timing-based heuristics are unreliable
2. Custom SRS algorithm - high effort, unproven effectiveness
3. Three ratings only - lose Easy rating, simpler mapping

## Decision
Map GradeStatus to FSRS Rating using three ratings only:
- `INCORRECT` -> `Rating.Again` (forgot, relearn from start)
- `PARTIAL` -> `Rating.Hard` (struggled, slow advancement)
- `CORRECT` -> `Rating.Good` (recalled, normal advancement)

Never use `Rating.Easy` - quiz-based grading has no "effortless recall" signal.

## Consequences

**Good:**
- Clean 1:1 mapping from grading to scheduling
- No false-positives on Easy (which would schedule reviews too far out)
- Conservative scheduling - better to review slightly early than forget

**Bad:**
- Slightly more reviews than optimal (missing Easy means max interval ~1 year vs ~2 years)
- Cannot distinguish "quick correct" from "slow correct" - both are Good

**Retention target:** 90% (FSRS default). May tune after collecting user data.
