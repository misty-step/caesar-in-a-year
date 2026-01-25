import { query, action, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Server secret for validating webhook calls.
 * This prevents client-side exploits while allowing Next.js API routes to call mutations.
 */
const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET?.trim();

function validateServerSecret(secret: string | undefined): void {
  // Use generic error to avoid leaking configuration state
  if (!CONVEX_WEBHOOK_SECRET || secret !== CONVEX_WEBHOOK_SECRET) {
    throw new ConvexError("Unauthorized");
  }
}

type SubscriptionStatus = Doc<"userProgress">["subscriptionStatus"];

/**
 * Get effective trial end date for a user.
 * If trialEndsAt is set explicitly, use that.
 * Otherwise, calculate from record creation time (lazy trial initialization).
 */
function getEffectiveTrialEnd(user: Doc<"userProgress">): number {
  if (user.trialEndsAt != null) return user.trialEndsAt;
  // Lazy trial: 14 days from when the user record was created
  return user._creationTime + TRIAL_DURATION_MS;
}

/**
 * Determines if a user has access to the app.
 * Access is granted if:
 * 1. Subscription is active
 * 2. Subscription is canceled but period hasn't ended
 * 3. Subscription is past_due but within current period (grace)
 * 4. Trial is active (calculated from record creation if not explicitly set)
 *
 * Access is denied for terminal/locked states (incomplete, unpaid, expired).
 */
export function hasAccess(user: Doc<"userProgress">): boolean {
  const now = Date.now();

  // Active subscription - most common for paying users
  if (user.subscriptionStatus === "active") {
    return true;
  }

  // Canceled but still in paid period
  if (
    user.subscriptionStatus === "canceled" &&
    user.currentPeriodEnd &&
    now < user.currentPeriodEnd
  ) {
    return true;
  }

  // Past due but still in current period (limited grace)
  if (
    user.subscriptionStatus === "past_due" &&
    user.currentPeriodEnd &&
    now < user.currentPeriodEnd
  ) {
    return true;
  }

  // Explicitly deny for terminal/locked states (before trial check)
  const lockedStates: SubscriptionStatus[] = ["incomplete", "unpaid", "expired"];
  if (user.subscriptionStatus && lockedStates.includes(user.subscriptionStatus)) {
    return false;
  }

  // Trial active (lazy: calculated from record creation if not explicitly set)
  const trialEnd = getEffectiveTrialEnd(user);
  if (now < trialEnd) {
    return true;
  }

  return false;
}

/**
 * Calculate days remaining in trial.
 * Uses lazy trial calculation if trialEndsAt not explicitly set.
 */
export function getTrialDaysRemaining(user: Doc<"userProgress">): number {
  const trialEnd = getEffectiveTrialEnd(user);
  const now = Date.now();
  if (now >= trialEnd) return 0;
  return Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
}

/**
 * Get billing status for UI.
 */
export const getStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        hasAccess: false,
        isAuthenticated: false,
        trialEndsAt: null,
        trialDaysRemaining: null,
        subscriptionStatus: null,
        currentPeriodEnd: null,
      };
    }

    const userId = identity.subject;
    const user = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!user) {
      // New user, no record yet - grant access, trial starts when record is created
      return {
        hasAccess: true,
        isAuthenticated: true,
        trialEndsAt: null,
        trialDaysRemaining: 14,
        subscriptionStatus: null,
        currentPeriodEnd: null,
      };
    }

    // Trial end is calculated lazily from record creation if not explicitly set
    const effectiveTrialEnd = getEffectiveTrialEnd(user);

    return {
      hasAccess: hasAccess(user),
      isAuthenticated: true,
      trialEndsAt: effectiveTrialEnd,
      trialDaysRemaining: getTrialDaysRemaining(user),
      subscriptionStatus: user.subscriptionStatus ?? null,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
    };
  },
});

/**
 * Initialize trial for new user.
 * Internal mutation; action validates server secret.
 */
export const initializeTrialInternal = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const trialEndsAt = Date.now() + TRIAL_DURATION_MS;

    if (existing) {
      // User exists but no trial set - set it now
      // Note: trialEndsAt=0 means "trial consumed", so check for null/undefined explicitly
      if (existing.trialEndsAt === undefined || existing.trialEndsAt === null) {
        await ctx.db.patch(existing._id, { trialEndsAt });
      }
      return { trialEndsAt: existing.trialEndsAt ?? trialEndsAt };
    }

    // Create new user progress with trial
    await ctx.db.insert("userProgress", {
      userId,
      streak: 0,
      totalXp: 0,
      maxDifficulty: 1,
      lastSessionAt: 0,
      trialEndsAt,
    });

    return { trialEndsAt };
  },
});

export const initializeTrial: ReturnType<typeof action> = action({
  args: {
    userId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    validateServerSecret(args.serverSecret);
    return await ctx.runMutation(internal.billing.initializeTrialInternal, {
      userId: args.userId,
    });
  },
});

/**
 * Update subscription status from Stripe webhook.
 * Internal mutation; action validates server secret.
 */
export const updateFromStripeInternal = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("past_due"),
        v.literal("canceled"),
        v.literal("expired"),
        v.literal("unpaid"),
        v.literal("incomplete")
      )
    ),
    currentPeriodEnd: v.optional(v.number()),
    eventTimestamp: v.number(),
    eventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("userProgress")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();

    if (!user) {
      console.error(
        `[Billing] No user found for Stripe customer: ${args.stripeCustomerId}`
      );
      return { success: false, reason: "user_not_found" };
    }

    // Strict deduplication: reject exact same event ID
    if (args.eventId && user.lastStripeEventId === args.eventId) {
      console.log(
        `[Billing] Duplicate event ${args.eventId} for customer: ${args.stripeCustomerId}`
      );
      return { success: false, reason: "duplicate_event" };
    }

    // Idempotency check: ignore strictly older events (< not <=)
    // Events in same second are allowed through (dedup by eventId above)
    if (
      user.lastStripeEventTimestamp &&
      args.eventTimestamp < user.lastStripeEventTimestamp
    ) {
      console.log(
        `[Billing] Ignoring stale event for customer: ${args.stripeCustomerId}`
      );
      return { success: false, reason: "stale_event" };
    }

    await ctx.db.patch(user._id, {
      ...(args.stripeSubscriptionId && {
        stripeSubscriptionId: args.stripeSubscriptionId,
      }),
      ...(args.subscriptionStatus && {
        subscriptionStatus: args.subscriptionStatus,
      }),
      ...(args.currentPeriodEnd !== undefined && { currentPeriodEnd: args.currentPeriodEnd }),
      lastStripeEventTimestamp: args.eventTimestamp,
      ...(args.eventId && { lastStripeEventId: args.eventId }),
      // Clear trial when subscription activates to prevent zombie trial access after cancel
      ...(args.subscriptionStatus === "active" && { trialEndsAt: 0 }),
    });

    return { success: true };
  },
});

export const updateFromStripe: ReturnType<typeof action> = action({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    subscriptionStatus: v.optional(
      v.union(
        v.literal("active"),
        v.literal("past_due"),
        v.literal("canceled"),
        v.literal("expired"),
        v.literal("unpaid"),
        v.literal("incomplete")
      )
    ),
    currentPeriodEnd: v.optional(v.number()),
    eventTimestamp: v.number(),
    eventId: v.optional(v.string()),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    validateServerSecret(args.serverSecret);
    return await ctx.runMutation(internal.billing.updateFromStripeInternal, {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      subscriptionStatus: args.subscriptionStatus,
      currentPeriodEnd: args.currentPeriodEnd,
      eventTimestamp: args.eventTimestamp,
      eventId: args.eventId,
    });
  },
});

/**
 * Link Stripe customer ID to user (called during checkout).
 * Creates userProgress if missing (new users subscribing directly).
 * Internal mutation; action validates server secret.
 */
export const linkStripeCustomerInternal = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    // Check if this Stripe customer is already linked to another user
    const existingCustomer = await ctx.db
      .query("userProgress")
      .withIndex("by_stripe_customer", (q) => q.eq("stripeCustomerId", stripeCustomerId))
      .first();

    if (existingCustomer && existingCustomer.userId !== userId) {
      throw new ConvexError("Stripe customer already linked to another user");
    }

    const user = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!user) {
      // New user subscribing directly - create userProgress with Stripe customer
      // Trial starts from creation time (lazy calculation via _creationTime)
      await ctx.db.insert("userProgress", {
        userId,
        streak: 0,
        totalXp: 0,
        maxDifficulty: 1,
        lastSessionAt: 0,
        stripeCustomerId,
      });
      return { success: true, created: true };
    }

    await ctx.db.patch(user._id, { stripeCustomerId });
    return { success: true, created: false };
  },
});

export const linkStripeCustomer: ReturnType<typeof action> = action({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    validateServerSecret(args.serverSecret);
    return await ctx.runMutation(internal.billing.linkStripeCustomerInternal, {
      userId: args.userId,
      stripeCustomerId: args.stripeCustomerId,
    });
  },
});

export const clearStripeCustomerInternal = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!user) {
      return { success: false, reason: "user_not_found" };
    }

    if (user.stripeCustomerId) {
      await ctx.db.patch(user._id, {
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
        subscriptionStatus: undefined,
        currentPeriodEnd: undefined,
        lastStripeEventTimestamp: undefined,
        lastStripeEventId: undefined,
      });
      console.log(`[Billing] Cleared Stripe customer for user: ${userId}`);
    }

    return { success: true };
  },
});

export const clearStripeCustomer: ReturnType<typeof action> = action({
  args: {
    userId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    validateServerSecret(args.serverSecret);
    return await ctx.runMutation(internal.billing.clearStripeCustomerInternal, {
      userId: args.userId,
    });
  },
});
