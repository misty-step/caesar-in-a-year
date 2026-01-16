import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 1 day grace for webhook delays

type SubscriptionStatus = Doc<"userProgress">["subscriptionStatus"];

/**
 * Determines if a user has access to the app.
 * Access is granted if:
 * 1. Trial is active (trialEndsAt > now)
 * 2. Subscription is active
 * 3. Subscription is canceled but period hasn't ended
 * 4. Subscription is past_due but within current period (grace)
 * 5. New user without billing data (grace period for webhook delays)
 */
export function hasAccess(user: Doc<"userProgress">): boolean {
  const now = Date.now();

  // Explicitly deny for terminal/locked states
  const lockedStates: SubscriptionStatus[] = ["incomplete", "unpaid", "expired"];
  if (user.subscriptionStatus && lockedStates.includes(user.subscriptionStatus)) {
    return false;
  }

  // Trial active
  if (user.trialEndsAt && now < user.trialEndsAt) {
    return true;
  }

  // Active subscription
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

  // New user grace period (webhook might not have arrived yet)
  // If no billing data at all, grant 1-day grace from account creation
  if (!user.trialEndsAt && !user.subscriptionStatus) {
    const userCreatedAt = user._creationTime;
    return now < userCreatedAt + GRACE_PERIOD_MS;
  }

  return false;
}

/**
 * Calculate days remaining in trial.
 * Returns null if not in trial.
 */
export function getTrialDaysRemaining(user: Doc<"userProgress">): number | null {
  if (!user.trialEndsAt) return null;
  const now = Date.now();
  if (now >= user.trialEndsAt) return 0;
  return Math.ceil((user.trialEndsAt - now) / (24 * 60 * 60 * 1000));
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
      // New user, no record yet - in grace period
      return {
        hasAccess: true,
        isAuthenticated: true,
        trialEndsAt: null,
        trialDaysRemaining: 14, // Will be set properly when Clerk webhook fires
        subscriptionStatus: null,
        currentPeriodEnd: null,
      };
    }

    return {
      hasAccess: hasAccess(user),
      isAuthenticated: true,
      trialEndsAt: user.trialEndsAt ?? null,
      trialDaysRemaining: getTrialDaysRemaining(user),
      subscriptionStatus: user.subscriptionStatus ?? null,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
    };
  },
});

/**
 * Initialize trial for new user (called by Clerk webhook).
 * Note: This is public but only called by our Clerk webhook after signature verification.
 */
export const initializeTrial = mutation({
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
      if (!existing.trialEndsAt) {
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

/**
 * Update subscription status from Stripe webhook.
 * Note: This is public but only called by our Stripe webhook after signature verification.
 */
export const updateFromStripe = mutation({
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

    // Idempotency check: ignore older events
    if (
      user.lastStripeEventTimestamp &&
      args.eventTimestamp <= user.lastStripeEventTimestamp
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
      ...(args.currentPeriodEnd && { currentPeriodEnd: args.currentPeriodEnd }),
      lastStripeEventTimestamp: args.eventTimestamp,
    });

    return { success: true };
  },
});

/**
 * Link Stripe customer ID to user (called during checkout).
 * Public mutation - requires auth and userId match.
 */
export const linkStripeCustomer = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    if (identity.subject !== userId) {
      throw new ConvexError("Cannot link customer for another user");
    }

    const user = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(user._id, { stripeCustomerId });
    return { success: true };
  },
});

/**
 * Check if user has access (for use in other mutations).
 * Throws if no access.
 */
export const requireAccess = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!user) {
      // New user, assume grace period
      return { hasAccess: true };
    }

    return { hasAccess: hasAccess(user) };
  },
});
