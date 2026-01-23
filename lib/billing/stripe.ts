import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Get Stripe client singleton. Lazy initialization to avoid
 * build-time errors when env vars aren't available.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(secretKey, {
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Stripe client for server-side operations.
 * @deprecated Use getStripe() for lazy initialization
 */
export const stripe = {
  get customers() { return getStripe().customers; },
  get checkout() { return getStripe().checkout; },
  get subscriptions() { return getStripe().subscriptions; },
  get billingPortal() { return getStripe().billingPortal; },
  get webhooks() { return getStripe().webhooks; },
};

/**
 * Price IDs for subscription plans.
 * Set in Stripe Dashboard and configure via environment variables.
 */
export const PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID?.trim();
export const PRICE_ID_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL?.trim();

/** @deprecated Use PRICE_ID_MONTHLY instead */
export const PRICE_ID = PRICE_ID_MONTHLY;

export type PlanType = "monthly" | "annual";

export function getPriceId(plan: PlanType): string | undefined {
  return plan === "annual" ? PRICE_ID_ANNUAL : PRICE_ID_MONTHLY;
}

export const PLAN_DETAILS = {
  monthly: {
    price: 14.99,
    interval: "month" as const,
    label: "$14.99/month",
  },
  annual: {
    price: 119.88,
    interval: "year" as const,
    label: "$119.88/year",
    monthlyEquivalent: 9.99,
    savings: 60,
  },
} as const;
