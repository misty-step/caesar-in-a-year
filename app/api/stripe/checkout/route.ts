import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, PRICE_ID } from "@/lib/billing/stripe";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET;

export async function POST() {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!PRICE_ID) {
    console.error("[Checkout] STRIPE_PRICE_ID not configured");
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    );
  }

  if (!CONVEX_WEBHOOK_SECRET) {
    console.error("[Checkout] CONVEX_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  try {
    const token = await getToken({ template: "convex" });

    // Get user's email from Clerk for Stripe customer
    const clerkAuth = await auth();
    // Use userId to look up email in userProgress or just use a placeholder
    // In production, you'd get this from Clerk's user object

    // Check if user already has a Stripe customer ID
    const billingStatus = await fetchQuery(
      api.billing.getStatus,
      {},
      token ? { token } : undefined
    );

    let customerId: string;

    // Get or create Stripe customer
    const userProgress = await fetchQuery(
      api.userProgress.get,
      { userId },
      token ? { token } : undefined
    );

    if (userProgress?.stripeCustomerId) {
      customerId = userProgress.stripeCustomerId;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          userId,
        },
      });
      customerId = customer.id;

      // Link customer to user (protected by server secret)
      await fetchMutation(
        api.billing.linkStripeCustomer,
        { userId, stripeCustomerId: customerId, serverSecret: CONVEX_WEBHOOK_SECRET! }
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/subscribe?canceled=true`,
      automatic_tax: { enabled: true },
      subscription_data: {
        metadata: {
          userId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Checkout] Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
