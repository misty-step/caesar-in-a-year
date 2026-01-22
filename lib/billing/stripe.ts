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
 * Price ID for the $14.99/month subscription.
 * Set in Stripe Dashboard and configure via environment variable.
 */
export const PRICE_ID = process.env.STRIPE_PRICE_ID?.trim();
