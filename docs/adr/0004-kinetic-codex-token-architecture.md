# ADR 0004: Kinetic Codex Two-Layer Token Architecture

## Status
Accepted

## Context
The design system evolved through multiple iterations (Neo-Lapidary, polish sessions). Raw Tailwind colors created inconsistency and made theming difficult. The "living manuscript" aesthetic needed systematic expression.

**Problems with raw colors:**
- `bg-slate-100` scattered everywhere - no semantic meaning
- Theme changes require grep-and-replace
- Designers can't communicate intent without implementation details
- Dark mode would require doubling all color specifications

**Alternatives considered:**
1. Tailwind theme extension only - colors available but no enforcement
2. CSS variables without semantics - variables exist but meaning unclear
3. Two-layer tokens with lint enforcement - primitives + semantics + tooling

## Decision
Two-layer token architecture with lint enforcement:

**Layer 1: Primitives (DNA)**
Raw values with evocative names reflecting the manuscript aesthetic:
- `vellum`, `vellum-warm`, `vellum-cool` (backgrounds)
- `iron-gall`, `iron-gall-light`, `iron-gall-muted` (text)
- `rubric`, `rubric-deep` (accent - manuscript rubric red)
- `laurel`, `terracotta`, `verdigris`, `bronze` (status colors)

**Layer 2: Semantics (Interface)**
What components actually use:
- `bg-background`, `bg-surface`, `bg-surface-hover`
- `text-text-primary`, `text-text-secondary`, `text-text-muted`
- `bg-accent`, `text-accent`, `hover:bg-accent-hover`
- `text-success`, `text-warning`, `text-celebration`, `text-achievement`

**Lint enforcement:** `scripts/lint-tokens.sh` checks for raw color class violations.

## Consequences

**Good:**
- Single source of truth for colors
- Semantic naming communicates intent
- Dark mode can swap primitives without touching components
- Lint catches violations before they spread
- Design vocabulary ("rubric", "vellum") reinforces aesthetic intent

**Bad:**
- Two-layer indirection adds complexity
- Tailwind @theme directive required for CSS variable bridge
- New developers must learn token vocabulary
- Some edge cases require escaping semantic system

**Why not a CSS-in-JS solution?**
Tailwind already handles utility generation. Adding styled-components/emotion would create two styling systems. The @theme directive bridges CSS variables to Tailwind utilities cleanly.
