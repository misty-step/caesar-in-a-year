import { describe, expect, it } from "vitest";
import {
  normalizeStripeSubscriptionStatus,
  reconcileSubscriptionState,
  type BillingRecordSnapshot,
  type StripeSubscriptionSnapshot,
} from "../reconciliation";

function createStripeSubscription(
  overrides: Partial<StripeSubscriptionSnapshot> = {}
): StripeSubscriptionSnapshot {
  return {
    id: "sub_123",
    customerId: "cus_123",
    status: "active",
    created: 1700000000,
    currentPeriodEnd: 1700003600,
    ...overrides,
  };
}

function createBillingRecord(
  overrides: Partial<BillingRecordSnapshot> = {}
): BillingRecordSnapshot {
  return {
    userId: "user_123",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    subscriptionStatus: "active",
    currentPeriodEnd: 1700003600 * 1000,
    ...overrides,
  };
}

describe("normalizeStripeSubscriptionStatus", () => {
  it("maps trialing to active", () => {
    expect(normalizeStripeSubscriptionStatus("trialing")).toBe("active");
  });

  it("maps incomplete_expired to incomplete", () => {
    expect(normalizeStripeSubscriptionStatus("incomplete_expired")).toBe(
      "incomplete"
    );
  });

  it("maps paused to active", () => {
    expect(normalizeStripeSubscriptionStatus("paused")).toBe("active");
  });

  it("maps cancel_at_period_end to canceled", () => {
    expect(normalizeStripeSubscriptionStatus("active", true)).toBe("canceled");
  });

  it("keeps unknown statuses unsupported even with cancel_at_period_end", () => {
    expect(
      normalizeStripeSubscriptionStatus("future_unrecognized_status", true)
    ).toBeNull();
  });

  it("passes through known statuses", () => {
    expect(normalizeStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(normalizeStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(normalizeStripeSubscriptionStatus("unpaid")).toBe("unpaid");
    expect(normalizeStripeSubscriptionStatus("incomplete")).toBe("incomplete");
  });

  it("returns null for unknown statuses", () => {
    expect(normalizeStripeSubscriptionStatus("mystery_status")).toBeNull();
  });
});

describe("reconcileSubscriptionState", () => {
  it("returns no mismatches when records align", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription()],
      billingRecords: [createBillingRecord()],
    });

    expect(result.mismatches).toHaveLength(0);
    expect(result.proposedUpdates).toHaveLength(0);
  });

  it("detects status mismatch and proposes update", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription({ status: "past_due" })],
      billingRecords: [createBillingRecord({ subscriptionStatus: "active" })],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("status_mismatch");
    expect(result.proposedUpdates[0]?.subscriptionStatus).toBe("past_due");
  });

  it("detects subscription mismatch and proposes update", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription({ id: "sub_latest" })],
      billingRecords: [createBillingRecord({ stripeSubscriptionId: "sub_old" })],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("subscription_mismatch");
    expect(result.proposedUpdates[0]?.stripeSubscriptionId).toBe("sub_latest");
  });

  it("detects period-end mismatch and proposes update", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription({ currentPeriodEnd: 1700004600 })],
      billingRecords: [createBillingRecord({ currentPeriodEnd: 1700003600 * 1000 })],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("period_end_mismatch");
    expect(result.proposedUpdates[0]?.currentPeriodEnd).toBe(1700004600 * 1000);
  });

  it("reports period-end mismatch but avoids futile update when Stripe period end is missing", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription({ currentPeriodEnd: undefined })],
      billingRecords: [createBillingRecord({ currentPeriodEnd: 1700003600 * 1000 })],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("period_end_mismatch");
    expect(result.proposedUpdates).toHaveLength(0);
  });

  it("detects billing records missing in stripe", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [],
      billingRecords: [createBillingRecord()],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("missing_in_stripe");
  });

  it("detects stripe subscriptions missing in billing records", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription()],
      billingRecords: [],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("missing_in_db");
  });

  it("prefers highest-priority subscription status over newest creation time", () => {
    const oldSub = createStripeSubscription({
      id: "sub_old",
      status: "active",
      created: 1700000000,
    });
    const newSub = createStripeSubscription({
      id: "sub_new",
      status: "past_due",
      created: 1700005000,
    });

    const result = reconcileSubscriptionState({
      stripeSubscriptions: [oldSub, newSub],
      billingRecords: [
        createBillingRecord({
          stripeSubscriptionId: "sub_new",
          subscriptionStatus: "canceled",
        }),
      ],
    });

    expect(result.mismatches).toHaveLength(2);
    expect(result.proposedUpdates[0]?.stripeSubscriptionId).toBe("sub_old");
    expect(result.proposedUpdates[0]?.subscriptionStatus).toBe("active");
  });

  it("surfaces unsupported stripe statuses and skips proposed updates", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription({ status: "new_status_from_stripe" })],
      billingRecords: [createBillingRecord()],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("unsupported_stripe_status");
    expect(result.proposedUpdates).toHaveLength(0);
  });

  it("includes raw status in unsupported mismatch when record is missing in db", () => {
    const result = reconcileSubscriptionState({
      stripeSubscriptions: [createStripeSubscription({ status: "future_status" })],
      billingRecords: [],
    });

    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0]?.type).toBe("unsupported_stripe_status");
    expect(result.mismatches[0]?.diff?.actual).toBe("future_status");
    expect(result.proposedUpdates).toHaveLength(0);
  });

  it("throws when duplicate billing records share a stripe customer id", () => {
    expect(() =>
      reconcileSubscriptionState({
        stripeSubscriptions: [],
        billingRecords: [
          createBillingRecord({ userId: "user_one", stripeCustomerId: "cus_dup" }),
          createBillingRecord({ userId: "user_two", stripeCustomerId: "cus_dup" }),
        ],
      })
    ).toThrow("Duplicate billing record for stripeCustomerId: cus_dup");
  });
});
