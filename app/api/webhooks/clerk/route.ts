import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("[Clerk Webhook] CLERK_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // Get raw body
  const payload = await req.text();

  // Verify signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let event: WebhookEvent;

  try {
    event = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("[Clerk Webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Handle user.created event
  if (event.type === "user.created") {
    const userId = event.data.id;

    try {
      const result = await fetchMutation(api.billing.initializeTrial, {
        userId,
      });
      console.log(
        `[Clerk Webhook] Trial initialized for user ${userId}, ends at ${new Date(result.trialEndsAt).toISOString()}`
      );
    } catch (err) {
      console.error(
        `[Clerk Webhook] Failed to initialize trial for user ${userId}:`,
        err
      );
      // Don't fail the webhook - user can still access via grace period
    }
  }

  return new Response("OK", { status: 200 });
}
