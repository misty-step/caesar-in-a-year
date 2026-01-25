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

    // Get user's Stripe customer ID from Convex
    const userProgress = await fetchQuery(
      api.userProgress.get,
      { userId },
      token ? { token } : undefined
    );

    if (!userProgress?.stripeCustomerId) {
      return NextResponse.json({ invoices: [] });
    }

    // Fetch invoices from Stripe
    const stripe = getStripe();
    const invoices = await stripe.invoices.list({
      customer: userProgress.stripeCustomerId,
      limit: 10,
    });

    return NextResponse.json({
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        date: inv.created * 1000, // Convert to ms
        amount: inv.amount_paid / 100, // Convert to dollars
        status: inv.status,
        invoicePdf: inv.invoice_pdf,
      })),
    });
  } catch (error) {
    console.error("[Invoices] Error fetching:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
