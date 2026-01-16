import { headers } from "next/headers";
import { getStripe } from "@/lib/billing/stripe";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type Stripe from "stripe";

const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET;

// Note: Stripe SDK v20 restructured types significantly:
// - Invoice.subscription moved to Invoice.parent.subscription_details.subscription
// - Subscription.current_period_end no longer in types (use invoice.period_end instead)
// Security: Mutations protected by CONVEX_WEBHOOK_SECRET - not exploitable from client

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  if (!CONVEX_WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] CONVEX_WEBHOOK_SECRET not configured");
    return new Response("Convex webhook secret not configured", { status: 500 });
  }

  // Read raw body for signature verification
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const eventTimestamp = event.created * 1000; // Convert to milliseconds

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer && session.subscription) {
          await fetchMutation(api.billing.updateFromStripe, {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: "active",
            eventTimestamp,
            serverSecret: CONVEX_WEBHOOK_SECRET,
          });
          console.log(
            `[Stripe Webhook] Checkout completed for customer ${session.customer}`
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionDetails = invoice.parent?.subscription_details;
        if (invoice.customer && subscriptionDetails?.subscription) {
          const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
          // invoice.period_end is the end of the billing period this invoice covers
          await fetchMutation(api.billing.updateFromStripe, {
            stripeCustomerId: customerId,
            currentPeriodEnd: invoice.period_end * 1000,
            subscriptionStatus: "active",
            eventTimestamp,
            serverSecret: CONVEX_WEBHOOK_SECRET,
          });
          console.log(
            `[Stripe Webhook] Payment succeeded for customer ${customerId}`
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
          await fetchMutation(api.billing.updateFromStripe, {
            stripeCustomerId: customerId,
            subscriptionStatus: "past_due",
            eventTimestamp,
            serverSecret: CONVEX_WEBHOOK_SECRET,
          });
          console.log(
            `[Stripe Webhook] Payment failed for customer ${customerId}`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
        await fetchMutation(api.billing.updateFromStripe, {
          stripeCustomerId: customerId,
          subscriptionStatus: "expired",
          eventTimestamp,
          serverSecret: CONVEX_WEBHOOK_SECRET,
        });
        console.log(
          `[Stripe Webhook] Subscription deleted for customer ${customerId}`
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
        let status: "active" | "canceled" | "past_due" | "unpaid" | "incomplete" =
          "active";

        if (subscription.cancel_at_period_end) {
          status = "canceled";
        } else if (subscription.status === "past_due") {
          status = "past_due";
        } else if (subscription.status === "unpaid") {
          status = "unpaid";
        } else if (subscription.status === "incomplete") {
          status = "incomplete";
        }

        // Note: currentPeriodEnd is set by invoice.payment_succeeded
        // Subscription status updates don't need to track period end
        await fetchMutation(api.billing.updateFromStripe, {
          stripeCustomerId: customerId,
          subscriptionStatus: status,
          eventTimestamp,
          serverSecret: CONVEX_WEBHOOK_SECRET,
        });
        console.log(
          `[Stripe Webhook] Subscription updated for customer ${customerId}, status: ${status}`
        );
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (charge.customer) {
          const customerId = typeof charge.customer === 'string'
            ? charge.customer
            : charge.customer.id;
          await fetchMutation(api.billing.updateFromStripe, {
            stripeCustomerId: customerId,
            subscriptionStatus: "expired",
            eventTimestamp,
            serverSecret: CONVEX_WEBHOOK_SECRET,
          });
          console.log(
            `[Stripe Webhook] Charge refunded for customer ${customerId}`
          );
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
