import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

let mockBillingStatus: Record<string, unknown> | undefined;

vi.mock("convex/react", () => ({
  useQuery: () => mockBillingStatus,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  PLAN_DETAILS: {
    annual: { price: 59, monthlyEquivalent: "4.92", savings: 60 },
    monthly: { price: 9.99 },
  },
}));

describe("SubscribePage isReturningUser copy", () => {
  beforeEach(() => {
    mockBillingStatus = undefined;
  });

  it("shows default copy for expired-trial user who never subscribed", async () => {
    mockBillingStatus = {
      hasAccess: false,
      isAuthenticated: true,
      trialEndsAt: Date.now() - 86400000,
      trialDaysRemaining: 0,
      subscriptionStatus: null,
      currentPeriodEnd: null,
    };

    const { default: SubscribePage } = await import(
      "@/app/(app)/subscribe/page"
    );
    const html = renderToString(<SubscribePage />);

    expect(html).toContain("Continue Your Journey");
    expect(html).not.toContain("Salve, Discipule!");
    expect(html).not.toContain("Welcome back");
  });

  it('shows "Welcome back" copy for canceled subscriber', async () => {
    mockBillingStatus = {
      hasAccess: false,
      isAuthenticated: true,
      trialEndsAt: 0,
      trialDaysRemaining: 0,
      subscriptionStatus: "canceled",
      currentPeriodEnd: Date.now() - 86400000,
    };

    const { default: SubscribePage } = await import(
      "@/app/(app)/subscribe/page"
    );
    const html = renderToString(<SubscribePage />);

    expect(html).toContain("Salve, Discipule!");
    expect(html).toContain("Welcome back");
  });

  it("does not show returning-user copy for active trial user", async () => {
    // Active trial users have hasAccess=true, which triggers a redirect
    // and renders null. Verify they never see "Welcome back" copy.
    mockBillingStatus = {
      hasAccess: true,
      isAuthenticated: true,
      trialEndsAt: Date.now() + 7 * 86400000,
      trialDaysRemaining: 7,
      subscriptionStatus: null,
      currentPeriodEnd: null,
    };

    const { default: SubscribePage } = await import(
      "@/app/(app)/subscribe/page"
    );
    const html = renderToString(<SubscribePage />);

    expect(html).not.toContain("Salve, Discipule!");
    expect(html).not.toContain("Welcome back");
  });
});
