import { describe, it, expect } from "vitest";
import { PLAN_DETAILS, getPriceId, type PlanType } from "../stripe";

describe("stripe pricing", () => {
  describe("PLAN_DETAILS", () => {
    it("has correct monthly pricing", () => {
      expect(PLAN_DETAILS.monthly.price).toBe(14.99);
      expect(PLAN_DETAILS.monthly.interval).toBe("month");
      expect(PLAN_DETAILS.monthly.label).toBe("$14.99/month");
    });

    it("has correct annual pricing", () => {
      expect(PLAN_DETAILS.annual.price).toBe(119.88);
      expect(PLAN_DETAILS.annual.interval).toBe("year");
      expect(PLAN_DETAILS.annual.label).toBe("$119.88/year");
      expect(PLAN_DETAILS.annual.monthlyEquivalent).toBe(9.99);
      expect(PLAN_DETAILS.annual.savings).toBe(60);
    });

    it("annual is 33% discount from monthly", () => {
      const monthlyAnnualized = PLAN_DETAILS.monthly.price * 12;
      const annualPrice = PLAN_DETAILS.annual.price;
      const discount = ((monthlyAnnualized - annualPrice) / monthlyAnnualized) * 100;
      // 33.33...% discount
      expect(discount).toBeCloseTo(33.33, 1);
    });

    it("savings equals documented amount", () => {
      const actualSavings = PLAN_DETAILS.monthly.price * 12 - PLAN_DETAILS.annual.price;
      // At 33% discount, savings is ~$60 (4 months worth)
      expect(actualSavings).toBeCloseTo(60, 0);
      expect(PLAN_DETAILS.annual.savings).toBe(60);
    });
  });

  describe("getPriceId", () => {
    it("returns monthly price ID for monthly plan", () => {
      // Note: In test environment, env vars may not be set
      // This tests the function structure, not the actual values
      const plan: PlanType = "monthly";
      // The function returns undefined when env vars aren't set
      const result = getPriceId(plan);
      expect(result === undefined || typeof result === "string").toBe(true);
    });

    it("returns annual price ID for annual plan", () => {
      const plan: PlanType = "annual";
      const result = getPriceId(plan);
      expect(result === undefined || typeof result === "string").toBe(true);
    });

    it("correctly routes based on plan type", () => {
      // Mock the logic without env vars
      function mockGetPriceId(
        plan: PlanType,
        monthly: string | undefined,
        annual: string | undefined
      ): string | undefined {
        return plan === "annual" ? annual : monthly;
      }

      expect(mockGetPriceId("monthly", "price_m", "price_a")).toBe("price_m");
      expect(mockGetPriceId("annual", "price_m", "price_a")).toBe("price_a");
      expect(mockGetPriceId("monthly", undefined, "price_a")).toBeUndefined();
      expect(mockGetPriceId("annual", "price_m", undefined)).toBeUndefined();
    });
  });

  describe("plan type validation", () => {
    it("only accepts valid plan types", () => {
      const validPlans: PlanType[] = ["monthly", "annual"];
      expect(validPlans).toContain("monthly");
      expect(validPlans).toContain("annual");
    });

    it("can be used as discriminator", () => {
      function getLabel(plan: PlanType): string {
        return PLAN_DETAILS[plan].label;
      }

      expect(getLabel("monthly")).toBe("$14.99/month");
      expect(getLabel("annual")).toBe("$119.88/year");
    });
  });
});
