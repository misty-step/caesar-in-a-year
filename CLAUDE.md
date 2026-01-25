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
pnpm check           # Run all linters (ESLint + token lint)
pnpm stripe:check    # Validate Stripe configuration
```

## Environment

### Variable Reference

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | AI-powered translation grading |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client auth |
| `CLERK_SECRET_KEY` | Clerk server auth |
| `CLERK_JWT_ISSUER_DOMAIN` | JWT validation (Convex only) |
| `STRIPE_SECRET_KEY` | Stripe API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client |
| `STRIPE_PRICE_ID` | Subscription price |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `CONVEX_WEBHOOK_SECRET` | Server-to-server auth for billing |

### Platform Locations (Critical!)

| Variable | Local | Vercel | Convex |
|----------|:-----:|:------:|:------:|
| `CLERK_*` (client/server) | ✓ | ✓ | - |
| `CLERK_JWT_ISSUER_DOMAIN` | - | - | ✓ |
| `STRIPE_*` | ✓ | ✓ | - |
| `GEMINI_API_KEY` | ✓ | ✓ | - |
| `CONVEX_WEBHOOK_SECRET` | ✓ | ✓ | ✓ |

**Common pitfalls:**
- `CLERK_JWT_ISSUER_DOMAIN` must match your Clerk instance domain
- Dev: `https://YOUR-INSTANCE.clerk.accounts.dev`
- Prod: `https://clerk.yourdomain.com` (custom domain)
- `CONVEX_WEBHOOK_SECRET` must be identical across Vercel and Convex

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for module map, data flow, and entry points.

**State Diagrams** (Mermaid):
- `docs/architecture/session-flow.md` — Step component states, FSRS, streak, circuit breaker
- `docs/architecture/grading-flow.md` — AI grading data flow, error paths, best-effort ops

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

### Billing (`lib/billing/`, `convex/billing.ts`)
Stripe subscription with 14-day trial. Deep module pattern:
- `lib/billing/stripe.ts` — Stripe client singleton, PRICE_ID export
- `convex/billing.ts` — Subscription state, `hasAccess()`, `updateFromStripe()`
- `app/api/webhooks/stripe/route.ts` — Webhook handler with signature verification

**Billing states**: `active`, `past_due`, `canceled`, `expired`, `unpaid`, `incomplete`

**Access logic** (in `hasAccess()`):
1. Active subscription → access
2. Canceled but in paid period → access
3. Past due but in grace period → access
4. Trial active → access
5. Everything else → no access

### Design System (Kinetic Codex)

Two-layer token architecture: primitives (DNA) → semantics (interface).

**Token Reference** (use semantics, never primitives):
```
Backgrounds:     bg-background, bg-surface, bg-surface-inverted
Borders:         border-border, border-border-subtle, border-border-inverted
Text:            text-text-primary, text-text-secondary, text-text-muted, text-text-faint
Accent:          bg-accent, text-accent, hover:bg-accent-hover, bg-accent-faint
Status:          text-success, bg-success-faint, text-warning, bg-warning-faint
Celebration:     text-celebration, bg-celebration-faint (correct answers)
Achievement:     text-achievement (XP/mastery)
```

**Motion**:
- `duration-fast` (150ms), `duration-normal` (300ms)
- `ease-ink` (ink-flow easing), `ease-spring` (playful bounce)
- `animate-fade-in`, `animate-bounce-in`, `animate-stamp`

**Component Patterns**:
- Use `cn()` from `@/lib/design` for class composition
- Use CVA components (Button, Card, ProgressBar) with variant props
- Always `min-h-dvh` (not `min-h-screen`) for mobile viewport
- Use `size-X` for square elements

**Lint**:
```bash
./scripts/lint-tokens.sh  # Check for raw color class violations
```

**Files**:
- `app/globals.css` — Token definitions, base styles
- `lib/design/index.ts` — cn() utility, tokens export
- `components/UI/` — CVA-based primitives (Button, Card, etc.)

## Quality Gates

**Git hooks (Lefthook):**
- `pre-commit`: lint, typecheck, token lint (staged files)
- `pre-push`: env parity check, test with coverage, build, convex typecheck

**Local checks:**
```bash
pnpm check           # ESLint + token lint
pnpm stripe:check    # Stripe config validation (requires env vars loaded)
pnpm test            # Vitest unit tests
pnpm test:ci         # Tests with coverage
```

**CI (GitHub Actions):**
- Runs on PRs to master and pushes to master
- Lint, typecheck, token lint, test, build
- Convex validation when convex/ files change

**Pre-deployment:**
- Run `pnpm stripe:check` to validate price IDs exist
- Verify Vercel env vars: `npx vercel env ls`
- Verify Convex prod env: `CONVEX_DEPLOYMENT=prod:xxx npx convex env list`

**Scripts:**
- `scripts/lint-tokens.sh` — Design token compliance
- `scripts/stripe-check.sh` — Stripe configuration audit
- `scripts/verify-env.sh` — Environment variable validation across platforms

## Before Deploying Billing Changes

**Critical:** Mocked tests don't catch configuration issues. Always verify manually.

```bash
# 1. Verify secret parity (this is now in pre-push, but double-check)
./scripts/verify-env.sh --parity-only

# 2. Validate Stripe configuration
pnpm stripe:check

# 3. Test checkout flow locally (actual Stripe test mode)
pnpm dev  # Then navigate to /subscribe and click "Subscribe Now"

# 4. Verify health endpoint
curl http://localhost:3000/api/health | jq

# 5. After deploy, verify webhook delivery in Stripe Dashboard
```

**If checkout fails with "Unauthorized":**
```bash
# Secret mismatch - sync local to Convex
npx convex env set CONVEX_WEBHOOK_SECRET "$(grep '^CONVEX_WEBHOOK_SECRET=' .env.local | cut -d= -f2-)"
```
