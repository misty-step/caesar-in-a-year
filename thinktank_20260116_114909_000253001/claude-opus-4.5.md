# Security Review: Stripe Billing Integration

## Executive Summary

**Yes, there are critical security vulnerabilities.** Both mutations should be `internalMutation`. Here's the analysis:

---

## Vulnerability 1: `updateFromStripe` - **CRITICAL**

### Attack Vector
Any authenticated (or even unauthenticated) user can call this public mutation directly:

```typescript
// Attacker's code - no Stripe webhook needed
await convex.mutation(api.billing.updateFromStripe, {
  stripeCustomerId: "cus_victim123", // Guess or enumerate
  subscriptionStatus: "active",
  currentPeriodEnd: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
  eventTimestamp: Date.now() + 1000000, // Future timestamp beats idempotency check
});
```

### Impact
1. **Grant free subscription**: Attacker sets their own subscription to "active" indefinitely
2. **Hijack/sabotage others**: Set victim's status to "expired" or "unpaid" to lock them out
3. **Bypass payment entirely**: Never need to interact with Stripe at all

### The Idempotency Check Doesn't Help
```typescript
if (args.eventTimestamp <= user.lastStripeEventTimestamp)
```
Attacker simply uses a future timestamp to bypass this.

---

## Vulnerability 2: `linkStripeCustomer` - **MEDIUM-HIGH**

### Current Protection
The mutation does check auth:
```typescript
if (identity.subject !== userId) {
  throw new ConvexError("Cannot link customer for another user");
}
```

### Remaining Attack Vector
```typescript
// Attacker links a Stripe customer ID they control to their account
await convex.mutation(api.billing.linkStripeCustomer, {
  userId: "attacker_user_id",
  stripeCustomerId: "cus_attacker_controlled",
});

// Then calls updateFromStripe (vulnerability 1) to activate it
await convex.mutation(api.billing.updateFromStripe, {
  stripeCustomerId: "cus_attacker_controlled",
  subscriptionStatus: "active",
  // ...
});
```

Even if `updateFromStripe` is fixed, allowing arbitrary customer ID linking is dangerous:
- Attacker could link a stolen/leaked Stripe customer ID
- Could link a customer ID from a different Stripe account (test mode, etc.)

---

## Vulnerability 3: `initializeTrial` - **MEDIUM**

### Attack Vector
```typescript
// Attacker resets their trial after it expires
await convex.mutation(api.billing.initializeTrial, {
  userId: "attacker_user_id",
});
```

The check `if (!existing.trialEndsAt)` prevents resetting, but:
- Attacker could call for other users (no auth check)
- Could be used to enumerate user IDs

---

## Recommended Fixes

### 1. Convert webhook handlers to `internalMutation`

```typescript
// billing.ts
export const updateFromStripe = internalMutation({
  // ... same implementation
});

export const initializeTrial = internalMutation({
  // ... same implementation
});
```

### 2. Call from HTTP endpoint with signature verification

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const body = await request.text();
    
    // CRITICAL: Verify webhook signature
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature!,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      return new Response("Invalid signature", { status: 400 });
    }
    
    // Now safe to call internal mutation
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      await ctx.runMutation(internal.billing.updateFromStripe, {
        stripeCustomerId: subscription.customer as string,
        subscriptionStatus: mapStripeStatus(subscription.status),
        currentPeriodEnd: subscription.current_period_end * 1000,
        eventTimestamp: event.created * 1000,
      });
    }
    
    return new Response("OK", { status: 200 });
  },
});
```

### 3. Fix `linkStripeCustomer`

Either make it internal (called server-side during checkout), or add validation:

```typescript
export const linkStripeCustomer = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    // Called from server-side checkout session creation
    // Stripe customer ID comes from Stripe API, not user input
    // ...
  },
});
```

---

## Summary Table

| Mutation | Current | Should Be | Risk if Unchanged |
|----------|---------|-----------|-------------------|
| `updateFromStripe` | `mutation` | `internalMutation` | **CRITICAL** - Free subscriptions |
| `linkStripeCustomer` | `mutation` | `internalMutation` | **HIGH** - Enables attack chain |
| `initializeTrial` | `mutation` | `internalMutation` | **MEDIUM** - Trial abuse |

The comment "only called by our Stripe webhook after signature verification" is **not enforced by the code** - it's wishful thinking. Public mutations are callable by anyone.