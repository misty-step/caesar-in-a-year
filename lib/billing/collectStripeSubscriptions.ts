import type { StripeSubscriptionSnapshot } from "./reconciliation";

export type StripeSubscriptionsPage = {
  data: StripeSubscriptionSnapshot[];
  hasMore: boolean;
  /** Raw cursor from the unfiltered Stripe page (last item ID before filtering). */
  lastRawId?: string;
};

export type FetchStripeSubscriptionsPage = (
  startingAfter?: string
) => Promise<StripeSubscriptionsPage>;

export async function collectStripeSubscriptions(
  fetchPage: FetchStripeSubscriptionsPage
): Promise<StripeSubscriptionSnapshot[]> {
  const subscriptions: StripeSubscriptionSnapshot[] = [];
  let startingAfter: string | undefined;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line no-await-in-loop -- Stripe pagination is cursor-based and must remain sequential.
    const page = await fetchPage(startingAfter);
    subscriptions.push(...page.data);
    hasMore = page.hasMore;

    // Use raw cursor (pre-filter) when available; fall back to last mapped item
    const lastId = page.lastRawId ?? page.data.at(-1)?.id;
    if (hasMore && !lastId) {
      throw new Error(
        "[Billing Reconcile] Stripe pagination invariant violated: hasMore=true with no cursor"
      );
    }
    startingAfter = lastId;
  }

  return subscriptions;
}
