import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/**
 * Server secret for validating webhook calls.
 * This prevents client-side exploits while allowing Next.js API routes to call mutations.
 */
const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET;

function validateServerSecret(secret: string | undefined): void {
  if (!CONVEX_WEBHOOK_SECRET) {
    throw new ConvexError("CONVEX_WEBHOOK_SECRET not configured");
  }
  if (secret !== CONVEX_WEBHOOK_SECRET) {
    throw new ConvexError("Invalid server secret");
  }
}

type SubscriptionStatus = Doc<"userProgress">["subscriptionStatus"];

/**
 * Get effective trial end date for a user.
 * If trialEndsAt is set explicitly, use that.
 * Otherwise, calculate from record creation time (lazy trial initialization).
 */
function getEffectiveTrialEnd(user: Doc<"userProgress">): number {
  if (user.trialEndsAt) return user.trialEndsAt;
  // Lazy trial: 14 days from when the user record was created
  return user._creationTime + TRIAL_DURATION_MS;
}

/**
 * Determines if a user has access to the app.
 * Access is granted if:
 * 1. Trial is active (calculated from record creation if not explicitly set)
 * 2. Subscription is active
 * 3. Subscription is canceled but period hasn't ended
 * 4. Subscription is past_due but within current period (grace)
 */
export function hasAccess(user: Doc<"userProgress">): boolean {
  const now = Date.now();

  // Explicitly deny for terminal/locked states
  const lockedStates: SubscriptionStatus[] = ["incomplete", "unpaid", "expired"];
  if (user.subscriptionStatus && lockedStates.includes(user.subscriptionStatus)) {
    return false;
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
 * Protected by server secret - only callable from trusted server code.
 */
export const initializeTrial = mutation({
  args: {
    userId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, { userId, serverSecret }) => {
    validateServerSecret(serverSecret);
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
 * Protected by server secret - only callable from trusted server code.
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
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    validateServerSecret(args.serverSecret);
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
 * Protected by server secret - only callable from trusted server code.
 */
export const linkStripeCustomer = mutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
    serverSecret: v.string(),
  },
  handler: async (ctx, { userId, stripeCustomerId, serverSecret }) => {
    validateServerSecret(serverSecret);
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
