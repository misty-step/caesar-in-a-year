export type BillingSubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "unpaid"
  | "incomplete";

export type BillingRecordSnapshot = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: BillingSubscriptionStatus;
  currentPeriodEnd?: number;
};

export type StripeSubscriptionSnapshot = {
  id: string;
  customerId: string;
  status: string;
  created: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
};

export type ReconciliationMismatchType =
  | "missing_in_stripe"
  | "missing_in_db"
  | "unsupported_stripe_status"
  | "status_mismatch"
  | "subscription_mismatch"
  | "period_end_mismatch";

export type ReconciliationMismatch = {
  type: ReconciliationMismatchType;
  stripeCustomerId: string;
  userId?: string;
  stripeSubscriptionId?: string;
  diff?: {
    expected: string | number | null;
    actual: string | number | null;
  };
};

export type ReconciliationUpdate = {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: BillingSubscriptionStatus;
  currentPeriodEnd?: number;
};

export type ReconciliationResult = {
  mismatches: ReconciliationMismatch[];
  proposedUpdates: ReconciliationUpdate[];
};

export function normalizeStripeSubscriptionStatus(
  status: string,
  cancelAtPeriodEnd = false
): BillingSubscriptionStatus | null {
  let normalized: BillingSubscriptionStatus | null;
  switch (status) {
    case "trialing":
    case "paused":
      normalized = "active";
      break;
    case "incomplete_expired":
      normalized = "incomplete";
      break;
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      normalized = status;
      break;
    default:
      return null;
  }

  return cancelAtPeriodEnd ? "canceled" : normalized;
}

function getStatusPriority(status: BillingSubscriptionStatus | null): number {
  switch (status) {
    case "active":
      return 5;
    case "past_due":
      return 4;
    case "canceled":
      return 3;
    case "incomplete":
      return 2;
    case "unpaid":
      return 1;
    case "expired":
      return 0;
    default:
      return -1;
  }
}

function getBestSubscriptionByCustomer(
  subscriptions: StripeSubscriptionSnapshot[]
): Map<string, StripeSubscriptionSnapshot> {
  const bestByCustomer = new Map<string, StripeSubscriptionSnapshot>();
  for (const subscription of subscriptions) {
    const existing = bestByCustomer.get(subscription.customerId);
    if (!existing) {
      bestByCustomer.set(subscription.customerId, subscription);
      continue;
    }

    const currentPriority = getStatusPriority(
      normalizeStripeSubscriptionStatus(
        subscription.status,
        subscription.cancelAtPeriodEnd ?? false
      )
    );
    const existingPriority = getStatusPriority(
      normalizeStripeSubscriptionStatus(
        existing.status,
        existing.cancelAtPeriodEnd ?? false
      )
    );

    if (
      currentPriority > existingPriority ||
      (currentPriority === existingPriority &&
        subscription.created > existing.created)
    ) {
      bestByCustomer.set(subscription.customerId, subscription);
    }
  }
  return bestByCustomer;
}

export function reconcileSubscriptionState(input: {
  stripeSubscriptions: StripeSubscriptionSnapshot[];
  billingRecords: BillingRecordSnapshot[];
}): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];
  const proposedUpdates: ReconciliationUpdate[] = [];
  const bestStripeByCustomer = getBestSubscriptionByCustomer(
    input.stripeSubscriptions
  );
  const billingByCustomer = new Map<string, BillingRecordSnapshot>();
  for (const record of input.billingRecords) {
    if (billingByCustomer.has(record.stripeCustomerId)) {
      throw new Error(
        `Duplicate billing record for stripeCustomerId: ${record.stripeCustomerId}`
      );
    }
    billingByCustomer.set(record.stripeCustomerId, record);
  }

  for (const [stripeCustomerId, billingRecord] of billingByCustomer.entries()) {
    const stripeSubscription = bestStripeByCustomer.get(stripeCustomerId);
    if (!stripeSubscription) {
      mismatches.push({
        type: "missing_in_stripe",
        stripeCustomerId,
        userId: billingRecord.userId,
        stripeSubscriptionId: billingRecord.stripeSubscriptionId,
      });
      continue;
    }

    const normalizedStatus = normalizeStripeSubscriptionStatus(
      stripeSubscription.status,
      stripeSubscription.cancelAtPeriodEnd ?? false
    );
    if (!normalizedStatus) {
      mismatches.push({
        type: "unsupported_stripe_status",
        stripeCustomerId,
        userId: billingRecord.userId,
        stripeSubscriptionId: stripeSubscription.id,
        diff: {
          expected: "known_stripe_status",
          actual: stripeSubscription.status,
        },
      });
      continue;
    }

    const stripePeriodEndMs =
      stripeSubscription.currentPeriodEnd === undefined
        ? undefined
        : stripeSubscription.currentPeriodEnd * 1000;
    const hasStripePeriodEnd = stripePeriodEndMs !== undefined;

    let needsUpdate = false;
    if (billingRecord.subscriptionStatus !== normalizedStatus) {
      needsUpdate = true;
      mismatches.push({
        type: "status_mismatch",
        stripeCustomerId,
        userId: billingRecord.userId,
        stripeSubscriptionId: stripeSubscription.id,
        diff: {
          expected: normalizedStatus,
          actual: billingRecord.subscriptionStatus ?? null,
        },
      });
    }

    if (billingRecord.stripeSubscriptionId !== stripeSubscription.id) {
      needsUpdate = true;
      mismatches.push({
        type: "subscription_mismatch",
        stripeCustomerId,
        userId: billingRecord.userId,
        stripeSubscriptionId: stripeSubscription.id,
        diff: {
          expected: stripeSubscription.id,
          actual: billingRecord.stripeSubscriptionId ?? null,
        },
      });
    }

    if (billingRecord.currentPeriodEnd !== stripePeriodEndMs) {
      if (hasStripePeriodEnd) {
        needsUpdate = true;
      }
      mismatches.push({
        type: "period_end_mismatch",
        stripeCustomerId,
        userId: billingRecord.userId,
        stripeSubscriptionId: stripeSubscription.id,
        diff: {
          expected: stripePeriodEndMs ?? null,
          actual: billingRecord.currentPeriodEnd ?? null,
        },
      });
    }

    if (needsUpdate) {
      const proposedUpdate: ReconciliationUpdate = {
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        subscriptionStatus: normalizedStatus,
      };
      if (hasStripePeriodEnd) {
        proposedUpdate.currentPeriodEnd = stripePeriodEndMs;
      }
      proposedUpdates.push(proposedUpdate);
    }
  }

  for (const stripeSubscription of bestStripeByCustomer.values()) {
    if (billingByCustomer.has(stripeSubscription.customerId)) {
      continue;
    }
    const normalizedStatus = normalizeStripeSubscriptionStatus(
      stripeSubscription.status,
      stripeSubscription.cancelAtPeriodEnd ?? false
    );
    if (normalizedStatus) {
      mismatches.push({
        type: "missing_in_db",
        stripeCustomerId: stripeSubscription.customerId,
        stripeSubscriptionId: stripeSubscription.id,
        diff: {
          expected: normalizedStatus,
          actual: null,
        },
      });
      continue;
    }

    mismatches.push({
      type: "unsupported_stripe_status",
      stripeCustomerId: stripeSubscription.customerId,
      stripeSubscriptionId: stripeSubscription.id,
      diff: {
        expected: "known_stripe_status",
        actual: stripeSubscription.status,
      },
    });
  }

  return { mismatches, proposedUpdates };
}
