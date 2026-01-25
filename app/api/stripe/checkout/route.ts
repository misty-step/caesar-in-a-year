import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe, getPriceId, type PlanType } from "@/lib/billing/stripe";
import { fetchAction, fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET?.trim();

/**
 * Resolve or create a Stripe customer, preventing duplicates AND account takeover.
 *
 * Security: We ONLY reuse an existing Stripe customer if:
 * 1. The customer is already linked to this user in our DB, OR
 * 2. The customer's metadata.userId matches this user (proves ownership)
 *
 * We do NOT link by email alone - that enables account takeover.
 */
async function resolveStripeCustomer(
  existingCustomerId: string | undefined,
  email: string | undefined,
  userId: string,
  serverSecret: string
): Promise<string> {
  // Already linked in our DB - validate it still exists in Stripe
  if (existingCustomerId) {
    try {
      await getStripe().customers.retrieve(existingCustomerId);
      return existingCustomerId;
    } catch {
      // Customer doesn't exist - likely environment mismatch
      console.warn(`[Checkout] Stale customer ID ${existingCustomerId}, clearing...`);
      await fetchAction(api.billing.clearStripeCustomer, {
        userId,
        serverSecret,
      });
    }
  }

  // Search by email - but ONLY link if metadata proves ownership
  if (email) {
    const existing = await getStripe().customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      const customer = existing.data[0];
      // Security: Only link if metadata confirms this user owns the customer
      if (customer.metadata?.userId === userId) {
        console.log(`[Checkout] Found verified customer ${customer.id} for user`);
        await fetchAction(api.billing.linkStripeCustomer, {
          userId,
          stripeCustomerId: customer.id,
          serverSecret,
        });
        return customer.id;
      }
      console.log(`[Checkout] Found customer by email but userId mismatch, creating new`);
    }
  }

  // Create new customer with userId in metadata
  const customer = await getStripe().customers.create({
    email,
    metadata: { userId },
  });
  console.log(`[Checkout] Created new customer ${customer.id}`);

  await fetchAction(api.billing.linkStripeCustomer, {
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
    // New users without userProgress get full trial
    const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
    const trialEndMs = userProgress?.trialEndsAt
      ?? (userProgress?._creationTime
        ? userProgress._creationTime + TRIAL_DURATION_MS
        : Date.now() + TRIAL_DURATION_MS);

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
