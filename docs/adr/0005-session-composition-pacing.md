# ADR 0005: Dynamic Session Composition and Pacing Strategy

## Status
Accepted

## Context
The app aims to complete De Bello Gallico (~2,211 sentences) in one year. Session composition must balance:
- Vocabulary foundation (early)
- Phrase chunking (scaffolding)
- Sentence review (retention)
- New reading (progress)

**Constraints:**
- ~6 sentences/day average to complete in 365 days
- Beginner needs more scaffolding than advanced learner
- Session length should feel consistent (not shorter/longer based on phase)

**Alternatives considered:**
1. Fixed session composition - ignores learner progression
2. User-configurable composition - cognitive burden, suboptimal choices
3. Phase-based automatic composition - adapts without user input

## Decision
Four-phase progression based on `daysActive`:

| Phase | Days | Vocab | Phrase | Review | New | Daily Sentences |
|-------|------|-------|--------|--------|-----|-----------------|
| beginner | 1-60 | 4 | 2 | 2 | 2 | 4 |
| early-mid | 61-180 | 2 | 2 | 3 | 4 | 6 |
| mid-late | 181-300 | 1 | 1 | 3 | 6 | 7 |
| advanced | 301-365 | 0 | 1 | 3 | 8 | 8 |

Items are interleaved round-robin for engagement (vocab -> phrase -> review -> repeat, reading at end).

**Sentence budget:**
- Days 1-60: 4/day x 60 = 240
- Days 61-180: 6/day x 120 = 720
- Days 181-300: 7/day x 120 = 840
- Days 301-365: 8/day x 65 = 520
- Total: 2,320 (buffer for catch-up)

## Consequences

**Good:**
- Beginners get vocabulary foundation before complex sentences
- Advanced learners focus on reading, less drilling
- Consistent session feel despite different phase compositions
- Interleaving prevents drill fatigue

**Bad:**
- Phase boundaries are arbitrary (day 60 vs 61 identical in skill)
- No way to skip phases if learner is already experienced
- `daysActive` != skill level (missed days still increment phase timer)

**Future consideration:** Could add skill-based phase detection using mastery metrics instead of pure time.
