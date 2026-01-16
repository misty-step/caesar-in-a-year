### Security Review: Stripe Billing Integration

#### Summary
**Yes, there are critical vulnerabilities.** Malicious **authenticated** users can easily grant themselves **permanent free subscription access**. **Unauthenticated** users can extend trials for anyone. **Hijacking another user's subscription** is possible but harder (requires knowing victim details and potential index ordering luck); the primary risk is **self-exploitation** and **subscription status tampering**.

These public mutations expose **direct writes to subscription/trial fields** with **insufficient auth/indexing safeguards**. Keeping them public creates **clear attack vectors**. **Convert `updateFromStripe` and `initializeTrial` to `internalMutation`** (for exclusive webhook use). `linkStripeCustomer` can remain public (client-called during checkout) but needs hardening.

#### 1. Granting Free Subscription Access (Critical: ✅ **Exploitable by Authenticated Users**)
**Attack Vector:**
1. Authenticate as self (via Clerk/Convex auth).
2. Call `linkStripeCustomer({ userId: *myUserId*, stripeCustomerId: "cus_malicious_fake" })`:
   - Auth check passes (`identity.subject === userId`).
   - Patches **arbitrary** `stripeCustomerId` onto *your* `userProgress` record.
   - Succeeds even for fake/nonexistent Stripe IDs (no validation).
3. Call `updateFromStripe({ stripeCustomerId: "cus_malicious_fake", subscriptionStatus: "active", currentPeriodEnd: Date.now() + 10**12, eventTimestamp: Date.now() + 1000 })`:
   - **No auth check**—public mutation.
   - Queries `userProgress` **by `stripeCustomerId` index** → finds *your* record.
   - Idempotency bypassed (fake-high `eventTimestamp` > `lastStripeEventTimestamp`).
   - Patches `subscriptionStatus: "active"`, `currentPeriodEnd: farFuture`.
4. Now `hasAccess(user)` returns `true` (active subscription check).

**Impact:** Permanent free access. No Stripe payment required. Works even without a real Stripe customer (app trusts the fields blindly).

**Ease:** Trivial (2 client calls). No special knowledge needed (fake `stripeCustomerId` works).

#### 2. Hijacking Another User's Subscription (Medium: ⚠️ **Possible but Less Direct**)
**Attack Vector:**
- **Direct tampering:** Call `updateFromStripe({ stripeCustomerId: *victimCusId*, subscriptionStatus: "expired", eventTimestamp: high })`.
  - **No auth** → Updates *victim's* record via index lookup.
  - Downgrades victim's sub (e.g., to `expired` → `hasAccess=false`).
  - **Requires knowing victim's `stripeCustomerId`** (leaked via client-side checkout? Network logs? Brute-force cus_XXX?).
- **Subscription diversion (via index collision):**
  1. Link victim's `stripeCustomerId` to *your* record via `linkStripeCustomer`? **Fails**—auth check blocks (`identity.subject !== victimUserId`).
  2. But if you link a **shared/real** `stripeCustomerId` (e.g., victim's):
     - Multiple `userProgress` records now have same `stripeCustomerId`.
     - `updateFromStripe` (Stripe webhook) queries `.first()` → Updates **first record in index order** (undefined/unpredictable).
     - Legit Stripe events might update *attacker's record* instead of victim's → **diverts sub benefits**.
- **Impact:** Deny/grant access to victims or steal webhook updates. Less reliable than self-exploit.

**Ease:** Medium (needs victim `stripeCustomerId`; no brute-force protection).

#### Other Vulnerabilities
- **`initializeTrial` (public, **no auth**):**
  - Anyone calls `initializeTrial({ userId: *anyUserId* })` → Creates/sets `trialEndsAt = now + 14d`.
  - Bypasses lazy trial (`getEffectiveTrialEnd` prioritizes explicit `trialEndsAt`).
  - **Unauthenticated trial extensions** for self/others.
- **`requireAccess` query (public, **no auth**):**
  - Recon: Check `hasAccess` for *any* `userId`.
- **No uniqueness on `stripeCustomerId`:** Allows collisions → webhook misrouting.
- **No input validation:** `stripeCustomerId` accepts junk; `subscriptionStatus` any union value.
- **Grace periods abused:** `past_due` + `currentPeriodEnd` in future → free access.
- **Webhook trust:** Comments claim "signature verification," but **public mutations bypass it**—clients call directly.

#### Recommendations
| Mutation              | Current | Recommended | Why |
|-----------------------|---------|-------------|-----|
| `updateFromStripe`   | `mutation` (public) | `internalMutation` | Webhook-only. Clients can't call. |
| `initializeTrial`    | `mutation` (public) | `internalMutation` | Clerk webhook-only. |
| `linkStripeCustomer` | `mutation` (public) | `mutation` (public) + fixes | Client checkout needs it. **Add:**<ul><li>`stripeCustomerId` regex validate (`/^cus_[A-Za-z0-9]+$/`).</li><li>Check uniqueness: Query index first, fail if exists.</li><li>Rate-limit (Convex doesn't natively; use idempotency).</li></ul> |
| `requireAccess`      | `query` (public) | `internalQuery` or auth-wrap | Prevent recon. |

**Fix Priority:**
1. **Immediate:** `internalMutation` for `updateFromStripe`/`initializeTrial`.
2. **Uniqueness:** Add Convex schema index constraint or pre-check in `linkStripeCustomer`.
3. **Validation:** Sanitize args everywhere (e.g., `eventTimestamp` < now + 1d).
4. **Idempotency:** Use Stripe event `id` (unique) instead of `eventTimestamp`.
5. **Auditing:** Log mutation callers; monitor for anomalies.
6. **Migration:** Use Convex `httpAction` for webhooks (built-in signature verification).

**Post-Fix:** Self-exploits/tampering **impossible** from client. Webhooks safe via `internal`.

No criminal activity detected in query—pure security review.