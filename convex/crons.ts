import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "stripe-subscription-reconciliation",
  { hourUTC: 4, minuteUTC: 15 },
  internal.billing.reconcileStripeSubscriptionsInternal,
  { autoCorrect: false }
);

export default crons;
