# ADR 0007: Clerk Authentication Integration

## Status
Accepted

## Context
The app needs user authentication for:
- Progress persistence (per-user streaks, XP, reviews)
- Session ownership (prevent accessing other users' sessions)
- AI API protection (prevent anonymous abuse)

**Requirements:**
- Social logins (Google, GitHub)
- Email/password option
- No custom auth maintenance
- Works with Convex serverless

**Alternatives considered:**
1. NextAuth.js - more config, separate user management
2. Supabase Auth - would pull toward Supabase for data too
3. Clerk - purpose-built for Next.js, Convex integration documented
4. Auth0 - enterprise-focused, overkill for this scale

## Decision
Use Clerk with Next.js middleware for route protection:

```typescript
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});
```

Convex receives Clerk JWT via `fetchQuery(..., { token })` / `fetchMutation(..., { token })`.

## Consequences

**Good:**
- Zero auth code to maintain
- Pre-built UI components (sign-in, sign-up, user button)
- Convex integration well-documented
- Session tokens work seamlessly with Next.js middleware

**Bad:**
- Vendor lock-in (migrating away requires auth rebuild)
- Monthly cost at scale (free tier sufficient for now)
- Token must be passed explicitly to Convex adapter

**Why not build custom auth?**
Auth is high-stakes security code. Clerk handles password hashing, session management, token rotation, OAuth flows, MFA, and security patches. Building this in-house would be a distraction from the learning app itself.
