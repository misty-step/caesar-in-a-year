import type { StripeSubscriptionSnapshot } from "./reconciliation";

export type StripeSubscriptionsPage = {
  data: StripeSubscriptionSnapshot[];
  hasMore: boolean;
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

    const lastId = page.data.at(-1)?.id;
    if (hasMore && !lastId) {
      throw new Error(
        "[Billing Reconcile] Stripe pagination invariant violated: hasMore=true with empty page"
      );
    }
    startingAfter = lastId;
  }

  return subscriptions;
}
