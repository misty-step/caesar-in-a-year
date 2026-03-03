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
};

export type ReconciliationMismatchType =
  | "missing_in_stripe"
  | "missing_in_db"
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
  status: string
): BillingSubscriptionStatus {
  switch (status) {
    case "trialing":
      return "active";
    case "incomplete_expired":
      return "expired";
    case "active":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return status;
    default:
      return "expired";
  }
}

function getLatestSubscriptionByCustomer(
  subscriptions: StripeSubscriptionSnapshot[]
): Map<string, StripeSubscriptionSnapshot> {
  const latestByCustomer = new Map<string, StripeSubscriptionSnapshot>();
  for (const subscription of subscriptions) {
    const existing = latestByCustomer.get(subscription.customerId);
    if (!existing || subscription.created > existing.created) {
      latestByCustomer.set(subscription.customerId, subscription);
    }
  }
  return latestByCustomer;
}

export function reconcileSubscriptionState(input: {
  stripeSubscriptions: StripeSubscriptionSnapshot[];
  billingRecords: BillingRecordSnapshot[];
}): ReconciliationResult {
  const mismatches: ReconciliationMismatch[] = [];
  const proposedUpdates: ReconciliationUpdate[] = [];
  const latestStripeByCustomer = getLatestSubscriptionByCustomer(
    input.stripeSubscriptions
  );
  const billingByCustomer = new Map(
    input.billingRecords.map((record) => [record.stripeCustomerId, record])
  );

  for (const [stripeCustomerId, billingRecord] of billingByCustomer.entries()) {
    const stripeSubscription = latestStripeByCustomer.get(stripeCustomerId);
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
      stripeSubscription.status
    );
    const stripePeriodEndMs =
      stripeSubscription.currentPeriodEnd === undefined
        ? undefined
        : stripeSubscription.currentPeriodEnd * 1000;

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
      needsUpdate = true;
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
      proposedUpdates.push({
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        subscriptionStatus: normalizedStatus,
        currentPeriodEnd: stripePeriodEndMs,
      });
    }
  }

  for (const stripeSubscription of latestStripeByCustomer.values()) {
    if (billingByCustomer.has(stripeSubscription.customerId)) {
      continue;
    }
    mismatches.push({
      type: "missing_in_db",
      stripeCustomerId: stripeSubscription.customerId,
      stripeSubscriptionId: stripeSubscription.id,
      diff: {
        expected: normalizeStripeSubscriptionStatus(stripeSubscription.status),
        actual: null,
      },
    });
  }

  return { mismatches, proposedUpdates };
}
