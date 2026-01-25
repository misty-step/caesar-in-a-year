import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/billing/stripe";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken({ template: "convex" });

    // Get user's Stripe IDs from Convex
    const userProgress = await fetchQuery(
      api.userProgress.get,
      { userId },
      token ? { token } : undefined
    );

    if (!userProgress?.stripeSubscriptionId) {
      return NextResponse.json({
        hasSubscription: false,
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        paymentMethod: null,
        priceAmount: null,
        priceInterval: null,
      });
    }

    // Fetch live subscription data from Stripe
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      userProgress.stripeSubscriptionId,
      { expand: ["default_payment_method", "items.data.price"] }
    );

    // Extract payment method details
    let paymentMethod = null;
    if (subscription.default_payment_method && typeof subscription.default_payment_method !== "string") {
      const pm = subscription.default_payment_method;
      if (pm.card) {
        paymentMethod = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        };
      }
    }

    // Extract price details
    const price = subscription.items.data[0]?.price;
    const priceAmount = price?.unit_amount ? price.unit_amount / 100 : null;
    const priceInterval = price?.recurring?.interval ?? null;

    // SDK v20: current_period_end is on items
    const periodEnd = subscription.items.data[0]?.current_period_end;

    return NextResponse.json({
      hasSubscription: true,
      status: subscription.status,
      currentPeriodEnd: periodEnd ? periodEnd * 1000 : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      paymentMethod,
      priceAmount,
      priceInterval,
    });
  } catch (error) {
    console.error("[Subscription] Error fetching details:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription details" },
      { status: 500 }
    );
  }
}
