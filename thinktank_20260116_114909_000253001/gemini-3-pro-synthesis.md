# Security Review: Stripe Billing Integration

## Executive Summary
**CRITICAL VULNERABILITY FOUND.**
The current implementation is insecure. By leaving these mutations `public`, you allow any user (authenticated or anonymous) to bypass all payment logic. The comment "only called by our Stripe webhook" is an assumption that the code does not enforce.

## Answers to Key Questions

### 1. Can a malicious user grant themselves free subscription access?
**Yes.** An attacker can grant themselves a "lifetime" subscription in seconds without interacting with Stripe.

**The Attack Vector:**
1.  **Link a fake ID:** The attacker calls `linkStripeCustomer` with their own User ID and a fake string (e.g., `"cus_fake123"`). Since the mutation is public and lacks validation, this succeeds.
2.  **Grant Access:** The attacker calls `updateFromStripe` with:
    *   `stripeCustomerId`: `"cus_fake123"`
    *   `subscriptionStatus`: `"active"`
    *   `currentPeriodEnd`: A timestamp 10 years in the future.
    *   `eventTimestamp`: A timestamp 1 second in the future (to bypass the idempotency check).

**Result:** The database updates the user's status to `active`. The application now considers them a paid subscriber.

### 2. Can a malicious user hijack another user's subscription?
**Yes.** There are two variants of this attack:

*   **Denial of Service (The "Poison Pill"):**
    If an attacker knows a victim's `stripeCustomerId`, they can call `updateFromStripe` with `subscriptionStatus: "expired"` and a massive `eventTimestamp`. This locks the victim out of their account, and because the timestamp is so high, legitimate future webhooks from Stripe will be ignored by your idempotency logic (`eventTimestamp <= user.lastStripeEventTimestamp`).

*   **Subscription Theft (The "Webhook Intercept"):**
    An attacker can call `linkStripeCustomer` to link *their* account to the *victim's* `stripeCustomerId`.
    When a real webhook arrives from Stripe, `updateFromStripe` executes:
    ```typescript
    .withIndex("by_stripe_customer", ...)
    .first()
    ```
    If the database index returns the attacker's record before the victim's, the legitimate payment update is applied to the attacker's account, not the victim's.

---

## Technical Recommendations

### 1. Convert to `internalMutation` (Required)
You must change the visibility of these functions so they cannot be called from the client.

**In `convex/billing.ts`:**
```typescript
import { internalMutation } from "./_generated/server";

// CHANGE: mutation -> internalMutation
export const updateFromStripe = internalMutation({
  args: { ... },
  handler: async (ctx, args) => {
    // Existing logic...
  },
});

// CHANGE: mutation -> internalMutation
export const initializeTrial = internalMutation({
  args: { ... },
  handler: async (ctx, args) => {
    // Existing logic...
  },
});
```

### 2. Implement HTTP Action with Signature Verification
You need an entry point that validates the request actually came from Stripe before calling the internal mutation.

**In `convex/http.ts`:**
```typescript
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    const body = await request.text();

    try {
      // 1. Verify the signature
      const event = stripe.webhooks.constructEvent(
        body,
        signature!,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      // 2. Only run mutation if signature is valid
      if (event.type === "customer.subscription.updated") {
        const sub = event.data.object as Stripe.Subscription;
        
        await ctx.runMutation(internal.billing.updateFromStripe, {
          stripeCustomerId: sub.customer as string,
          subscriptionStatus: sub.status,
          currentPeriodEnd: sub.current_period_end * 1000,
          eventTimestamp: event.created * 1000,
        });
      }
      
      return new Response(null, { status: 200 });
    } catch (err) {
      return new Response("Webhook Error", { status: 400 });
    }
  },
});

export default http;
```

### 3. Fix `linkStripeCustomer`
This mutation should generally not be called directly by the client with raw IDs.

*   **Best Practice:** This should be an `internalMutation` called by a backend process after a Checkout Session is created.
*   **Alternative (If must be public):** It must validate that the `stripeCustomerId` actually belongs to the authenticated user (e.g., by checking against a signed session ID from Stripe). It should also fail if that Customer ID is already linked to another user.

### 4. Logic Bug Fix
In your code:
```typescript
...(args.currentPeriodEnd && { currentPeriodEnd: args.currentPeriodEnd }),
```
If `currentPeriodEnd` is `0` (which can happen in some edge cases or testing), this check fails (falsy) and the field isn't updated.
**Fix:**
```typescript
...(args.currentPeriodEnd !== undefined && { currentPeriodEnd: args.currentPeriodEnd }),
```