Yes—**as written, a malicious user can (1) give themselves paid access and (2) hijack/DoS another user’s subscription**, because you’re trusting client-callable (“public”) mutations with Stripe-authoritative fields.

Both `updateFromStripe` and `linkStripeCustomer` should not be public in their current form. Making them `internalMutation` (and only callable from a server-side webhook handler / checkout finalizer that you control) is the right direction.

---

## 1) Can they grant themselves free subscription access?

### Attack: call `updateFromStripe` directly
`updateFromStripe` is effectively “set subscription fields by stripeCustomerId”. If it’s public, anyone can call it with arbitrary values:

- set `subscriptionStatus: "active"`
- set `currentPeriodEnd` far in the future
- set `eventTimestamp` to a huge number to defeat your “stale event” check forever

That immediately makes `hasAccess()` return `true`.

The only “hard part” for the attacker is knowing a `stripeCustomerId` that exists in your DB. But that’s often not a strong barrier:
- IDs can leak via client logs, analytics, error messages, or support screenshots
- a user can set *their own* `stripeCustomerId` first (see next section), then call `updateFromStripe` using that value

### Attack chain: self-assign a customer id → then mark active
1) Call `linkStripeCustomer` for themselves with **any** `stripeCustomerId` string (doesn’t have to be real).
2) Call `updateFromStripe` using that same `stripeCustomerId` and set status to `active`.

Because `updateFromStripe` only checks “is there a user row with this stripeCustomerId”, the attacker has now created that mapping themselves.

Result: **paid access without paying**.

---

## 2) Can they hijack another user’s subscription?

### Attack: steal the victim’s Stripe customer mapping
`linkStripeCustomer` lets an authenticated user set *their* `stripeCustomerId` to an arbitrary value. If the attacker learns the victim’s `cus_...` value, they can:

- set their own `userProgress.stripeCustomerId = victimCusId`

Now, when real Stripe webhooks arrive for the victim’s customer, your webhook logic (`updateFromStripe`) does:

```ts
.withIndex("by_stripe_customer", q => q.eq("stripeCustomerId", args.stripeCustomerId))
.first()
```

So the webhook will update **whichever user record currently holds that customer id**. If the attacker has pointed their account at the victim’s customer id, the webhook updates the attacker’s account.

This is classic “customer-id binding” hijack.

### Attack: directly disable/poison the victim with `updateFromStripe`
If the attacker knows the victim’s `stripeCustomerId`, they can also just call `updateFromStripe` to:
- set `subscriptionStatus: "expired"` / `"unpaid"` / `"incomplete"` (your `lockedStates` deny access)
- set `eventTimestamp` huge so real Stripe events become “stale” and are ignored

Result: **deny access to victim** (and potentially permanently, until you manually fix `lastStripeEventTimestamp`).

---

## Should these be `internalMutation`?
### `updateFromStripe`: **Yes, should be internal**
This mutation is effectively “apply Stripe as source of truth.” It must only be callable after:
- verifying Stripe signature (in an HTTP action / webhook handler), and
- parsing the event from Stripe

If it remains public, the attack is simply: **forge Stripe events**.

### `linkStripeCustomer`: **Either internal OR redesigned**
Right now it’s “client tells server what Stripe customer id to bind.” That is not safe.

Safer patterns:
- Make it `internalMutation` and only call it from a trusted server flow after verifying a Stripe Checkout Session, OR
- Don’t expose `stripeCustomerId` setting at all; instead accept a `checkoutSessionId` and on the server:
  - retrieve the session from Stripe with your secret key
  - verify `session.client_reference_id` / `session.metadata.userId` matches the authenticated user
  - then write the `customer` value from Stripe into your DB

Also enforce invariants:
- A `stripeCustomerId` should be **unique** and **immutable once set** (or only changeable via a privileged/admin/internal path).
- If a `stripeCustomerId` is already linked to a different user, refuse.

---

## Concrete “what’s the attack vector if public?”
- **Free access**: attacker calls `updateFromStripe` with `subscriptionStatus="active"` and future `currentPeriodEnd`.
- **Permanent takeover/DoS**: attacker sets `eventTimestamp` far in the future so real events are ignored.
- **Subscription hijack**: attacker sets their `stripeCustomerId` to the victim’s; future real webhooks update attacker instead of victim.
- **Victim lockout**: attacker calls `updateFromStripe` on victim’s `stripeCustomerId` and sets status to `"unpaid"`/`"expired"`.

---

## One more bug worth fixing (not the main vuln, but related)
In `updateFromStripe` you have:

```ts
...(args.currentPeriodEnd && { currentPeriodEnd: args.currentPeriodEnd }),
```

This won’t write `0` (falsy). Use an explicit undefined check:

```ts
...(args.currentPeriodEnd !== undefined && { currentPeriodEnd: args.currentPeriodEnd }),
```

Same idea for other optional fields if `""` or `0` could ever be valid.

---

## Bottom line
- **`updateFromStripe` must not be public.** Make it `internalMutation` and call it only from a Stripe-signature-verified webhook handler.
- **`linkStripeCustomer` must not accept an arbitrary customer id from the client.** Make it internal or rework it to derive the customer id from a verified Checkout Session / PaymentIntent on the server.
- If left public, the system is vulnerable to **forged subscription state**, **event timestamp poisoning**, and **customer-id rebinding hijacks**.