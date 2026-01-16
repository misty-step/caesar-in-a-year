import { headers } from "next/headers";
import { getStripe } from "@/lib/billing/stripe";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type Stripe from "stripe";

const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Note: Stripe SDK v20 restructured types significantly:
// - Invoice.subscription moved to Invoice.parent.subscription_details.subscription
// - Subscription.current_period_end no longer in types (use invoice.period_end instead)
// Security: Mutations protected by CONVEX_WEBHOOK_SECRET - not exploitable from client

/**
 * Extract customer ID from Stripe object (handles string or expanded object)
 */
function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Get subscription ID from invoice (handles SDK v20 structure changes)
 * SDK v20 moved subscription to parent.subscription_details.subscription
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // SDK v20: invoice.parent.subscription_details.subscription
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (parentSub) {
    return typeof parentSub === "string" ? parentSub : parentSub.id;
  }
  // Fallback for older API versions - use type assertion since types changed
  const legacyInvoice = invoice as unknown as { subscription?: string | { id: string } };
  if (legacyInvoice.subscription) {
    return typeof legacyInvoice.subscription === "string"
      ? legacyInvoice.subscription
      : legacyInvoice.subscription.id;
  }
  return null;
}

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  if (!CONVEX_WEBHOOK_SECRET) {
    console.error("[Stripe Webhook] CONVEX_WEBHOOK_SECRET not configured");
    return new Response("Convex webhook secret not configured", { status: 500 });
  }

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
  const eventId = event.id;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.customer && session.subscription) {
          await fetchMutation(api.billing.updateFromStripe, {
            stripeCustomerId: getCustomerId(session.customer),
            stripeSubscriptionId: typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id,
            subscriptionStatus: "active",
            eventTimestamp,
            eventId,
            serverSecret: CONVEX_WEBHOOK_SECRET,
          });
          console.log(
            `[Stripe Webhook] Checkout completed for customer ${session.customer}`
          );
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = getCustomerId(subscription.customer);
        await fetchMutation(api.billing.updateFromStripe, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: "active",
          eventTimestamp,
          eventId,
          serverSecret: CONVEX_WEBHOOK_SECRET,
        });
        console.log(
          `[Stripe Webhook] Subscription created for customer ${customerId}`
        );
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (invoice.customer && subscriptionId) {
          const customerId = getCustomerId(invoice.customer);
          await fetchMutation(api.billing.updateFromStripe, {
            stripeCustomerId: customerId,
            currentPeriodEnd: invoice.period_end * 1000,
            subscriptionStatus: "active",
            eventTimestamp,
            eventId,
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
          const customerId = getCustomerId(invoice.customer);
          await fetchMutation(api.billing.updateFromStripe, {
            stripeCustomerId: customerId,
            subscriptionStatus: "past_due",
            eventTimestamp,
            eventId,
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
        const customerId = getCustomerId(subscription.customer);
        await fetchMutation(api.billing.updateFromStripe, {
          stripeCustomerId: customerId,
          subscriptionStatus: "expired",
          eventTimestamp,
          eventId,
          serverSecret: CONVEX_WEBHOOK_SECRET,
        });
        console.log(
          `[Stripe Webhook] Subscription deleted for customer ${customerId}`
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = getCustomerId(subscription.customer);
        let status: "active" | "canceled" | "past_due" | "unpaid" | "incomplete" =
          "active";

        // Map Stripe subscription status to our internal status
        if (subscription.status === "canceled") {
          status = "canceled";
        } else if (subscription.cancel_at_period_end) {
          status = "canceled";
        } else if (subscription.status === "past_due") {
          status = "past_due";
        } else if (subscription.status === "unpaid") {
          status = "unpaid";
        } else if (subscription.status === "incomplete") {
          status = "incomplete";
        }

        await fetchMutation(api.billing.updateFromStripe, {
          stripeCustomerId: customerId,
          subscriptionStatus: status,
          eventTimestamp,
          eventId,
          serverSecret: CONVEX_WEBHOOK_SECRET,
        });
        console.log(
          `[Stripe Webhook] Subscription updated for customer ${customerId}, status: ${status}`
        );
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // Only act on FULL refunds - partial refunds shouldn't revoke access
        const isFullRefund = charge.refunded && charge.amount_refunded === charge.amount;
        if (charge.customer && isFullRefund) {
          const customerId = getCustomerId(charge.customer);
          // Log for manual review - let subscription lifecycle handle actual cancellation
          // A refund doesn't necessarily mean the subscription is canceled
          console.warn(
            `[Stripe Webhook] Full refund for customer ${customerId} - manual review recommended`
          );
          // Only expire if this is clearly a chargeback/dispute situation
          // For normal refunds, let subscription.deleted handle access revocation
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
