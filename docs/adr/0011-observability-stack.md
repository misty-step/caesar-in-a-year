# 0011. Observability Stack: Sentry + PostHog

Date: 2026-01-26
Status: accepted

## Context

Production apps need visibility into errors and user behavior. Without observability:
- Errors fail silently, discovered only when users complain
- No data on feature usage or friction points
- Debugging production issues requires reproducing locally

Constraints:
- Budget-conscious (solo/small team)
- GDPR-aware (PII handling)
- Low overhead (no complex infrastructure)

## Decision

**Error Tracking: Sentry**
- Industry standard, generous free tier
- Native Next.js integration (`@sentry/nextjs`)
- Source map uploads for readable stack traces
- Session replay for error context

**Analytics: PostHog**
- Privacy-focused (can self-host)
- Generous free tier (1M events/month)
- Combines analytics, feature flags, and session recording
- Shared across portfolio projects (project 293836)

**Structured Logging**
- Custom logger with JSON output in production
- Consistent format for log aggregation
- Error normalization via `logError()`

## Consequences

**Easier:**
- Debug production errors with full context
- Understand user flows and drop-off points
- Identify performance bottlenecks

**Harder:**
- Additional env vars to configure per environment
- PII must be consciously scrubbed
- Two dashboards to check (Sentry + PostHog)

**Configuration:**
- Sentry: per-project (caesar-in-a-year)
- PostHog: shared portfolio project (simpler, unified view)
