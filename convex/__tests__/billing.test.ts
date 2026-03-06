import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasAccess,
  getTrialDaysRemaining,
  listStripeBillingRecordsInternal,
  reconcileStripeSubscriptionsInternal,
} from "../billing";
import type { Doc } from "../_generated/dataModel";
import { getStripe } from "../../lib/billing/stripe";

// Mock Date.now for deterministic tests
const MOCK_NOW = 1700000000000; // Fixed timestamp

describe("billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
    process.env.STRIPE_SECRET_KEY = "sk_test_billing_reconcile";
  });

  // Helper to create a minimal userProgress doc for testing
  // Default: trial expired (created 15+ days ago) to isolate subscription logic
  function createUser(
    overrides: Partial<Doc<"userProgress">> = {}
  ): Doc<"userProgress"> {
    return {
      _id: "test_id" as Doc<"userProgress">["_id"],
      _creationTime: MOCK_NOW - 15 * 24 * 60 * 60 * 1000, // 15 days ago (trial expired)
      userId: "user_123",
      streak: 0,
      totalXp: 0,
      maxDifficulty: 1,
      lastSessionAt: 0,
      ...overrides,
    };
  }

  // Helper for users with active trial
  function createTrialUser(
    overrides: Partial<Doc<"userProgress">> = {}
  ): Doc<"userProgress"> {
    return createUser({
      _creationTime: MOCK_NOW - 7 * 24 * 60 * 60 * 1000, // 7 days ago (trial active)
      ...overrides,
    });
  }

  describe("hasAccess", () => {
    describe("active subscription", () => {
      it("grants access for active subscription", () => {
        const user = createUser({ subscriptionStatus: "active" });
        expect(hasAccess(user)).toBe(true);
      });

      it("grants access regardless of trial status when active", () => {
        const user = createUser({
          subscriptionStatus: "active",
          trialEndsAt: MOCK_NOW - 1000, // Trial expired
        });
        expect(hasAccess(user)).toBe(true);
      });
    });

    describe("canceled subscription", () => {
      it("grants access if period not yet ended", () => {
        const user = createUser({
          subscriptionStatus: "canceled",
          currentPeriodEnd: MOCK_NOW + 7 * 24 * 60 * 60 * 1000, // 7 days from now
        });
        expect(hasAccess(user)).toBe(true);
      });

      it("denies access if period ended", () => {
        const user = createUser({
          subscriptionStatus: "canceled",
          currentPeriodEnd: MOCK_NOW - 1000, // Period ended
        });
        expect(hasAccess(user)).toBe(false);
      });

      it("denies access if period end not set", () => {
        const user = createUser({
          subscriptionStatus: "canceled",
          currentPeriodEnd: undefined,
        });
        expect(hasAccess(user)).toBe(false);
      });
    });

    describe("past_due subscription", () => {
      it("grants access if still in current period (grace)", () => {
        const user = createUser({
          subscriptionStatus: "past_due",
          currentPeriodEnd: MOCK_NOW + 3 * 24 * 60 * 60 * 1000, // 3 days from now
        });
        expect(hasAccess(user)).toBe(true);
      });

      it("denies access if past current period", () => {
        const user = createUser({
          subscriptionStatus: "past_due",
          currentPeriodEnd: MOCK_NOW - 1000,
        });
        expect(hasAccess(user)).toBe(false);
      });
    });

    describe("locked states", () => {
      it("denies access for incomplete status", () => {
        const user = createUser({ subscriptionStatus: "incomplete" });
        expect(hasAccess(user)).toBe(false);
      });

      it("denies access for unpaid status", () => {
        const user = createUser({ subscriptionStatus: "unpaid" });
        expect(hasAccess(user)).toBe(false);
      });

      it("denies access for expired status", () => {
        const user = createUser({ subscriptionStatus: "expired" });
        expect(hasAccess(user)).toBe(false);
      });

      it("denies access for locked states even with valid period end", () => {
        const user = createUser({
          subscriptionStatus: "expired",
          currentPeriodEnd: MOCK_NOW + 30 * 24 * 60 * 60 * 1000,
        });
        expect(hasAccess(user)).toBe(false);
      });
    });

    describe("trial access", () => {
      it("grants access when trial not expired (explicit trialEndsAt)", () => {
        const user = createUser({
          trialEndsAt: MOCK_NOW + 7 * 24 * 60 * 60 * 1000, // 7 days from now
        });
        expect(hasAccess(user)).toBe(true);
      });

      it("denies access when trial expired (explicit trialEndsAt)", () => {
        const user = createUser({
          trialEndsAt: MOCK_NOW - 1000, // Expired
        });
        expect(hasAccess(user)).toBe(false);
      });

      it("grants access via lazy trial calculation from _creationTime", () => {
        // User created 7 days ago, trial is 14 days, so 7 days remaining
        const user = createTrialUser();
        expect(hasAccess(user)).toBe(true);
      });

      it("denies access when lazy trial expired", () => {
        // User created 15 days ago, trial is 14 days (default createUser)
        const user = createUser();
        expect(hasAccess(user)).toBe(false);
      });

      it("prefers explicit trialEndsAt over lazy calculation", () => {
        // _creationTime would give trial, but explicit trialEndsAt says expired
        const user = createTrialUser({
          trialEndsAt: MOCK_NOW - 1000, // Explicitly expired
        });
        expect(hasAccess(user)).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("handles trialEndsAt = 0 as immediately expired (not falsy)", () => {
        // Regression: falsy check would fall back to lazy trial calculation
        const user = createTrialUser({
          trialEndsAt: 0, // Explicitly set to 0 = expired
        });
        expect(hasAccess(user)).toBe(false);
      });

      it("handles exact trial end boundary (at boundary = expired)", () => {
        const user = createUser({
          trialEndsAt: MOCK_NOW, // Exactly now
        });
        expect(hasAccess(user)).toBe(false);
      });

      it("handles exact period end boundary (at boundary = expired)", () => {
        const user = createUser({
          subscriptionStatus: "canceled",
          currentPeriodEnd: MOCK_NOW, // Exactly now
        });
        expect(hasAccess(user)).toBe(false);
      });

      it("handles zero timestamps", () => {
        const user = createUser({
          trialEndsAt: 0,
          currentPeriodEnd: 0,
        });
        expect(hasAccess(user)).toBe(false);
      });

      it("handles null/undefined subscription status", () => {
        const user = createUser({
          subscriptionStatus: undefined,
          trialEndsAt: MOCK_NOW + 1000,
        });
        expect(hasAccess(user)).toBe(true); // Falls through to trial check
      });
    });
  });

  describe("getTrialDaysRemaining", () => {
    it("returns 0 when trial expired", () => {
      const user = createUser({
        trialEndsAt: MOCK_NOW - 24 * 60 * 60 * 1000, // 1 day ago
      });
      expect(getTrialDaysRemaining(user)).toBe(0);
    });

    it("returns correct days remaining (rounds up)", () => {
      const user = createUser({
        trialEndsAt: MOCK_NOW + 1.5 * 24 * 60 * 60 * 1000, // 1.5 days
      });
      expect(getTrialDaysRemaining(user)).toBe(2); // Rounds up
    });

    it("returns exact days when on boundary", () => {
      const user = createUser({
        trialEndsAt: MOCK_NOW + 7 * 24 * 60 * 60 * 1000, // Exactly 7 days
      });
      expect(getTrialDaysRemaining(user)).toBe(7);
    });

    it("calculates from _creationTime when trialEndsAt not set", () => {
      // Created 7 days ago, trial is 14 days, so 7 days remaining
      const user = createTrialUser({
        trialEndsAt: undefined,
      });
      expect(getTrialDaysRemaining(user)).toBe(7);
    });

    it("returns 14 for brand new user", () => {
      const user = createUser({
        _creationTime: MOCK_NOW, // Just created
        trialEndsAt: undefined,
      });
      expect(getTrialDaysRemaining(user)).toBe(14);
    });

    it("returns 0 for user created more than 14 days ago without explicit trial", () => {
      // Default createUser is 15 days ago
      const user = createUser({
        trialEndsAt: undefined,
      });
      expect(getTrialDaysRemaining(user)).toBe(0);
    });
  });

  describe("internal reconciliation handlers", () => {
    it("listStripeBillingRecordsInternal returns only users with stripeCustomerId", async () => {
      const collect = vi.fn().mockResolvedValue([
        {
          userId: "user_with_stripe",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          subscriptionStatus: "active",
          currentPeriodEnd: 1700005000000,
        },
        {
          userId: "user_without_stripe",
          stripeCustomerId: undefined,
        },
      ]);
      const withIndex = vi.fn().mockReturnValue({ collect });
      const query = vi.fn().mockReturnValue({ withIndex });
      const ctx = {
        db: {
          query,
        },
      };

      const result = await (
        listStripeBillingRecordsInternal as unknown as {
          _handler: (ctx: unknown, args: {}) => Promise<unknown>;
        }
      )._handler(ctx, {});

      expect(query).toHaveBeenCalledWith("userProgress");
      expect(withIndex).toHaveBeenCalledWith("by_stripe_customer");
      expect(result).toEqual([
        {
          userId: "user_with_stripe",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          subscriptionStatus: "active",
          currentPeriodEnd: 1700005000000,
        },
      ]);
    });

    it("reconcileStripeSubscriptionsInternal maps Stripe page data and applies auto-corrections", async () => {
      const stripe = getStripe();
      const listSpy = vi.spyOn(stripe.subscriptions, "list").mockResolvedValue({
        object: "list",
        url: "/v1/subscriptions",
        has_more: false,
        data: [
          {
            id: "sub_latest",
            customer: { id: "cus_123" },
            status: "active",
            created: 1700000000,
            cancel_at_period_end: false,
            items: {
              data: [{ current_period_end: 1700003600 }],
            },
          },
          {
            id: "sub_missing_customer",
            customer: null,
            status: "active",
            created: 1700000001,
            cancel_at_period_end: false,
            items: {
              data: [{ current_period_end: 1700003601 }],
            },
          },
        ],
      } as never);

      const runQuery = vi.fn().mockResolvedValue([
        {
          userId: "user_123",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_old",
          subscriptionStatus: "past_due",
          currentPeriodEnd: 1700000000000,
        },
      ]);
      const runMutation = vi.fn().mockResolvedValue({ success: true });
      const ctx = {
        runQuery,
        runMutation,
      };

      const result = await (
        reconcileStripeSubscriptionsInternal as unknown as {
          _handler: (
            ctx: unknown,
            args: { autoCorrect?: boolean }
          ) => Promise<unknown>;
        }
      )._handler(ctx, { autoCorrect: true });

      expect(listSpy).toHaveBeenCalledWith({
        status: "all",
        limit: 100,
      });
      expect(runQuery).toHaveBeenCalledTimes(1);
      expect(runMutation).toHaveBeenCalledTimes(1);
      expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_latest",
        subscriptionStatus: "active",
        currentPeriodEnd: 1700003600000,
        eventTimestamp: MOCK_NOW,
        eventId: `reconcile:${MOCK_NOW}:cus_123`,
      });
      expect(result).toEqual({
        scannedStripeSubscriptions: 1,
        scannedBillingRecords: 1,
        mismatchCount: 3,
        proposedUpdateCount: 1,
        correctedCount: 1,
        failedCorrections: 0,
        autoCorrect: true,
      });
    });

    it("reconcileStripeSubscriptionsInternal continues after per-record mutation failure", async () => {
      const stripe = getStripe();
      vi.spyOn(stripe.subscriptions, "list").mockResolvedValue({
        object: "list",
        url: "/v1/subscriptions",
        has_more: false,
        data: [
          {
            id: "sub_1",
            customer: { id: "cus_1" },
            status: "active",
            created: 1700000000,
            cancel_at_period_end: false,
            items: {
              data: [{ current_period_end: 1700003600 }],
            },
          },
          {
            id: "sub_2",
            customer: { id: "cus_2" },
            status: "active",
            created: 1700000100,
            cancel_at_period_end: false,
            items: {
              data: [{ current_period_end: 1700007200 }],
            },
          },
        ],
      } as never);

      const runQuery = vi.fn().mockResolvedValue([
        {
          userId: "user_1",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_old_1",
          subscriptionStatus: "past_due",
          currentPeriodEnd: 1700000000000,
        },
        {
          userId: "user_2",
          stripeCustomerId: "cus_2",
          stripeSubscriptionId: "sub_old_2",
          subscriptionStatus: "past_due",
          currentPeriodEnd: 1700000000000,
        },
      ]);
      const runMutation = vi
        .fn()
        .mockRejectedValueOnce(new Error("first mutation failed"))
        .mockResolvedValueOnce({ success: true });
      const ctx = {
        runQuery,
        runMutation,
      };

      const result = await (
        reconcileStripeSubscriptionsInternal as unknown as {
          _handler: (
            ctx: unknown,
            args: { autoCorrect?: boolean }
          ) => Promise<unknown>;
        }
      )._handler(ctx, { autoCorrect: true });

      expect(runMutation).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        scannedStripeSubscriptions: 2,
        scannedBillingRecords: 2,
        mismatchCount: 6,
        proposedUpdateCount: 2,
        correctedCount: 1,
        failedCorrections: 1,
        autoCorrect: true,
      });
    });

    it("reconcileStripeSubscriptionsInternal counts stale_event as success, not failure", async () => {
      const stripe = getStripe();
      vi.spyOn(stripe.subscriptions, "list").mockResolvedValue({
        object: "list",
        url: "/v1/subscriptions",
        has_more: false,
        data: [
          {
            id: "sub_1",
            customer: { id: "cus_1" },
            status: "active",
            created: 1700000000,
            cancel_at_period_end: false,
            items: {
              data: [{ current_period_end: 1700003600 }],
            },
          },
        ],
      } as never);

      const runQuery = vi.fn().mockResolvedValue([
        {
          userId: "user_1",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_old",
          subscriptionStatus: "past_due",
          currentPeriodEnd: 1700000000000,
        },
      ]);
      const runMutation = vi.fn().mockResolvedValue({
        success: false,
        reason: "stale_event",
      });
      const ctx = { runQuery, runMutation };

      const result = await (
        reconcileStripeSubscriptionsInternal as unknown as {
          _handler: (
            ctx: unknown,
            args: { autoCorrect?: boolean }
          ) => Promise<unknown>;
        }
      )._handler(ctx, { autoCorrect: true });

      expect(result).toMatchObject({
        correctedCount: 1,
        failedCorrections: 0,
      });
    });
  });
});
