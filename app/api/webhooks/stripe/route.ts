import { headers } from "next/headers";
import { getStripe } from "@/lib/billing/stripe";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type Stripe from "stripe";

const CONVEX_WEBHOOK_SECRET = process.env.CONVEX_WEBHOOK_SECRET?.trim();
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();

// Security: Actions protected by CONVEX_WEBHOOK_SECRET - not exploitable from client
// Note: Stripe SDK types may not perfectly match runtime API responses.
// We use defensive extraction with fallbacks for maximum compatibility.

/**
 * Extract customer ID from Stripe object (handles string or expanded object)
 */
function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer): string {
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Get subscription ID from invoice.
 * Stripe SDK v20 types don't include the legacy `subscription` field,
 * but it exists in API responses for subscription invoices.
 * We use defensive extraction with fallback to parent.subscription_details.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Try legacy top-level subscription field (exists in API, not in SDK types)
  const legacySub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (legacySub) {
    return typeof legacySub === "string" ? legacySub : legacySub.id;
  }

  // Fallback to parent.subscription_details (SDK v20+ structure)
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (parentSub) {
    return typeof parentSub === "string" ? parentSub : parentSub.id;
  }

  return null;
}

/**
 * Map Stripe subscription status to our internal status.
 * Treats 'trialing' and 'active' as active access states.
 */
function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
  cancelAtPeriodEnd: boolean
): "active" | "canceled" | "past_due" | "unpaid" | "incomplete" {
  if (stripeStatus === "canceled") return "canceled";
  if (cancelAtPeriodEnd) return "canceled";
  if (stripeStatus === "past_due") return "past_due";
  if (stripeStatus === "unpaid") return "unpaid";
  if (stripeStatus === "incomplete" || stripeStatus === "incomplete_expired") return "incomplete";
  // 'active' and 'trialing' both grant access
  return "active";
}

/**
 * Attempt to update user billing, with fallback to link via userId metadata.
 * Returns true if successful, throws if should retry.
 */
async function updateWithFallback(
  stripeCustomerId: string,
  userId: string | undefined,
  update: {
    stripeSubscriptionId?: string;
    subscriptionStatus?: "active" | "canceled" | "past_due" | "unpaid" | "incomplete" | "expired";
    currentPeriodEnd?: number;
    eventTimestamp: number;
    eventId: string;
  }
): Promise<void> {
  const result = await fetchAction(api.billing.updateFromStripe, {
    stripeCustomerId,
    ...update,
    serverSecret: CONVEX_WEBHOOK_SECRET!,
  });

  if (result.success) return;

  // Stale/duplicate events are safe to ignore
  if (result.reason === "stale_event" || result.reason === "duplicate_event") {
    console.log(`[Stripe Webhook] Ignoring ${result.reason} for customer ${stripeCustomerId}`);
    return;
  }

  // User not found - try fallback via userId metadata
  if (result.reason === "user_not_found" && userId) {
    console.warn(`[Stripe Webhook] User not found for customer ${stripeCustomerId}, attempting fallback link via userId ${userId}`);

    // Link customer to user
    await fetchAction(api.billing.linkStripeCustomer, {
      userId,
      stripeCustomerId,
      serverSecret: CONVEX_WEBHOOK_SECRET!,
    });

    // Retry the update
    const retryResult = await fetchAction(api.billing.updateFromStripe, {
      stripeCustomerId,
      ...update,
      serverSecret: CONVEX_WEBHOOK_SECRET!,
    });

    if (retryResult.success) {
      console.log(`[Stripe Webhook] Fallback link succeeded for customer ${stripeCustomerId}`);
      return;
    }

    // Fallback failed - throw to trigger Stripe retry
    throw new Error(`Fallback link failed: ${retryResult.reason}`);
  }

  // No fallback possible - throw to trigger Stripe retry
  throw new Error(`Update failed: ${result.reason}`);
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
          const stripeCustomerId = getCustomerId(session.customer);
          // Session metadata contains userId for fallback (set in checkout creation)
          const userId = session.metadata?.userId;

          await updateWithFallback(stripeCustomerId, userId, {
            stripeSubscriptionId: typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id,
            subscriptionStatus: "active",
            eventTimestamp,
            eventId,
          });
          console.log(`[Stripe Webhook] Checkout completed for customer ${stripeCustomerId}`);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = getCustomerId(subscription.customer);
        const userId = subscription.metadata?.userId;
        const status = mapSubscriptionStatus(subscription.status, subscription.cancel_at_period_end);
        // Extract current_period_end with fallback (root level or item level)
        const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
          ?? subscription.items.data[0]?.current_period_end;

        await updateWithFallback(stripeCustomerId, userId, {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: status,
          ...(periodEnd && { currentPeriodEnd: periodEnd * 1000 }),
          eventTimestamp,
          eventId,
        });
        console.log(`[Stripe Webhook] Subscription created for customer ${stripeCustomerId}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        if (invoice.customer && subscriptionId) {
          const stripeCustomerId = getCustomerId(invoice.customer);

          await updateWithFallback(stripeCustomerId, undefined, {
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd: invoice.period_end * 1000,
            subscriptionStatus: "active",
            eventTimestamp,
            eventId,
          });
          console.log(`[Stripe Webhook] Payment succeeded for customer ${stripeCustomerId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          const stripeCustomerId = getCustomerId(invoice.customer);

          // Preserve existing period_end as grace period - only update status
          // Stripe will send subscription.updated if period changes
          await updateWithFallback(stripeCustomerId, undefined, {
            subscriptionStatus: "past_due",
            eventTimestamp,
            eventId,
          });
          console.log(`[Stripe Webhook] Payment failed for customer ${stripeCustomerId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = getCustomerId(subscription.customer);

        await updateWithFallback(stripeCustomerId, undefined, {
          subscriptionStatus: "expired",
          eventTimestamp,
          eventId,
        });
        console.log(`[Stripe Webhook] Subscription deleted for customer ${stripeCustomerId}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = getCustomerId(subscription.customer);
        const status = mapSubscriptionStatus(subscription.status, subscription.cancel_at_period_end);
        // Extract current_period_end with fallback (root level or item level)
        const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
          ?? subscription.items.data[0]?.current_period_end;

        await updateWithFallback(stripeCustomerId, undefined, {
          subscriptionStatus: status,
          ...(periodEnd && { currentPeriodEnd: periodEnd * 1000 }),
          eventTimestamp,
          eventId,
        });
        console.log(`[Stripe Webhook] Subscription updated for customer ${stripeCustomerId}, status: ${status}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // Only act on FULL refunds - partial refunds shouldn't revoke access
        const isFullRefund = charge.refunded && charge.amount_refunded === charge.amount;
        if (charge.customer && isFullRefund) {
          const customerId = getCustomerId(charge.customer);
          // Log for manual review - let subscription lifecycle handle actual cancellation
          console.warn(`[Stripe Webhook] Full refund for customer ${customerId} - manual review recommended`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Return 500 to trigger Stripe retry (exponential backoff)
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
