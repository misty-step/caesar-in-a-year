# Architecture Decision Records

ADRs capture significant architectural decisions with context and consequences.

## Format

Use `NNNN-title.md` format. Each ADR contains:

```markdown
# NNNN. Title

Date: YYYY-MM-DD
Status: proposed | accepted | deprecated | superseded by [NNNN]

## Context
What is the issue? What forces are at play?

## Decision
What is the change being proposed/made?

## Consequences
What becomes easier or harder as a result?
```

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-data-adapter-pattern.md) | Data Adapter Pattern | Accepted |
| [0002](0002-fsrs-three-rating-system.md) | FSRS Three-Rating System | Accepted |
| [0003](0003-ai-grading-resilience.md) | AI Grading Resilience | Accepted |
| [0004](0004-kinetic-codex-token-architecture.md) | Kinetic Codex Token Architecture | Accepted |
| [0005](0005-session-composition-pacing.md) | Session Composition and Pacing | Accepted |
| [0006](0006-timezone-aware-streaks.md) | Timezone-Aware Streaks | Accepted |
| [0007](0007-clerk-auth-integration.md) | Clerk Auth Integration | Accepted |
| [0008](0008-convex-as-primary-database.md) | Convex as Primary Database | Accepted |
| [0009](0009-gemini-flash-for-grading.md) | Gemini 3 Flash for AI Grading | Accepted |
| [0010](0010-history-aware-grading.md) | History-Aware AI Grading | Accepted |

## Creating a New ADR

1. Copy template: `cp docs/adr/TEMPLATE.md docs/adr/NNNN-title.md`
2. Fill in context, decision, consequences
3. Add to index above
4. Reference from ARCHITECTURE.md if significant
