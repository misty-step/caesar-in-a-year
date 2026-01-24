import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe, getPriceId, type PlanType } from "@/lib/billing/stripe";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET?.trim();

/**
 * Resolve or create a Stripe customer, preventing duplicates.
 * 1. Use existing customerId if linked
 * 2. Search Stripe by email (handles abandoned checkouts)
 * 3. Create new customer as fallback
 */
async function resolveStripeCustomer(
  existingCustomerId: string | undefined,
  email: string | undefined,
  userId: string,
  serverSecret: string
): Promise<string> {
  // Already linked
  if (existingCustomerId) {
    return existingCustomerId;
  }

  // Search by email to prevent duplicates
  if (email) {
    const existing = await getStripe().customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      const customerId = existing.data[0].id;
      console.log(`[Checkout] Found existing Stripe customer ${customerId} for user`);
      // Link this customer to user
      await fetchMutation(api.billing.linkStripeCustomer, {
        userId,
        stripeCustomerId: customerId,
        serverSecret,
      });
      return customerId;
    }
  }

  // Create new customer
  const customer = await getStripe().customers.create({
    email,
    metadata: { userId },
  });
  console.log(`[Checkout] Created new customer ${customer.id}`);

  // Link to user
  await fetchMutation(api.billing.linkStripeCustomer, {
    userId,
    stripeCustomerId: customer.id,
    serverSecret,
  });

  return customer.id;
}

export async function POST(request: NextRequest) {
  const { userId, getToken } = await auth();
  const user = await currentUser();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse plan from request body, default to annual
  let plan: PlanType = "annual";
  try {
    const body = await request.json();
    if (body.plan === "monthly" || body.plan === "annual") {
      plan = body.plan;
    }
  } catch {
    // No body or invalid JSON - use default (annual)
  }

  const priceId = getPriceId(plan);
  if (!priceId) {
    console.error(`[Checkout] STRIPE_PRICE_ID${plan === "annual" ? "_ANNUAL" : ""} not configured`);
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

    const email = user?.emailAddresses[0]?.emailAddress;

    // Get existing user progress (if any) to check for Stripe customer ID and trial status
    const userProgress = await fetchQuery(
      api.userProgress.get,
      { userId },
      token ? { token } : undefined
    );

    // Calculate trial end to honor remaining trial days
    // Uses explicit trialEndsAt, or lazy calculation from _creationTime
    const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
    const trialEndMs = userProgress?.trialEndsAt
      ?? (userProgress?._creationTime ? userProgress._creationTime + TRIAL_DURATION_MS : null);

    const now = Date.now();
    // Only pass trial_end if user has remaining trial (not new users paying immediately)
    const hasRemainingTrial = trialEndMs && trialEndMs > now;
    const trialEndSeconds = hasRemainingTrial ? Math.floor(trialEndMs / 1000) : undefined;

    // Resolve or create Stripe customer
    const customerId = await resolveStripeCustomer(
      userProgress?.stripeCustomerId,
      email,
      userId,
      CONVEX_WEBHOOK_SECRET
    );

    // Create checkout session with userId in both session and subscription metadata
    // This provides fallback for webhook if linkStripeCustomer races
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/subscribe?canceled=true`,
      automatic_tax: { enabled: true },
      metadata: { userId }, // Session-level metadata for webhook fallback
      subscription_data: {
        metadata: { userId },
        // Honor remaining trial days - Stripe delays billing until trial_end
        ...(trialEndSeconds && { trial_end: trialEndSeconds }),
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
