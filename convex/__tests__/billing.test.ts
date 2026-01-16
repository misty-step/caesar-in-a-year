import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasAccess, getTrialDaysRemaining } from "../billing";
import type { Doc } from "../_generated/dataModel";

// Mock Date.now for deterministic tests
const MOCK_NOW = 1700000000000; // Fixed timestamp

describe("billing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
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
});
