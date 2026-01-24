import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/billing/stripe";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function POST() {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken({ template: "convex" });

    // Get user's Stripe customer ID
    const userProgress = await fetchQuery(
      api.userProgress.get,
      { userId },
      token ? { token } : undefined
    );

    if (!userProgress?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 }
      );
    }

    // Create portal session
    const session = await getStripe().billingPortal.sessions.create({
      customer: userProgress.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Portal] Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
