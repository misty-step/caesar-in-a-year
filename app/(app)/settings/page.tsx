"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/UI/Button";
import { cn } from "@/lib/design";

type SubscriptionDetails = {
  hasSubscription: boolean;
  status: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  priceAmount: number | null;
  priceInterval: string | null;
};

type Invoice = {
  id: string;
  date: number;
  amount: number;
  status: string;
  invoicePdf: string | null;
};

function StatusBadge({ status, cancelAtPeriodEnd }: { status: string | null; cancelAtPeriodEnd: boolean }) {
  if (!status) return null;

  const getStatusConfig = () => {
    if (cancelAtPeriodEnd && status === "active") {
      return { label: "Cancels at period end", className: "bg-warning-faint text-warning" };
    }
    switch (status) {
      case "active":
      case "trialing":
        return { label: status === "trialing" ? "Trial" : "Active", className: "bg-success-faint text-success" };
      case "past_due":
        return { label: "Past due", className: "bg-error-faint text-error" };
      case "canceled":
      case "expired":
        return { label: "Canceled", className: "bg-warning-faint text-warning" };
      case "incomplete":
      case "unpaid":
        return { label: "Payment required", className: "bg-error-faint text-error" };
      default:
        return { label: status, className: "bg-surface text-text-secondary" };
    }
  };

  const config = getStatusConfig();
  return (
    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", config.className)}>
      {config.label}
    </span>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function SettingsPage() {
  const router = useRouter();
  const billingStatus = useQuery(api.billing.getStatus);

  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscription details from Stripe
  useEffect(() => {
    async function fetchSubscription() {
      try {
        const res = await fetch("/api/stripe/subscription");
        if (!res.ok) throw new Error("Failed to fetch subscription");
        const data = await res.json();
        setSubscription(data);
      } catch (err) {
        console.error("Error fetching subscription:", err);
        setError("Could not load subscription details");
      } finally {
        setIsLoadingSubscription(false);
      }
    }
    fetchSubscription();
  }, []);

  // Fetch billing history
  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/api/stripe/invoices");
        if (!res.ok) throw new Error("Failed to fetch invoices");
        const data = await res.json();
        setInvoices(data.invoices);
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setIsLoadingInvoices(false);
      }
    }
    fetchInvoices();
  }, []);

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create portal session");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error opening portal:", err);
      setError("Could not open billing portal");
      setIsOpeningPortal(false);
    }
  };

  const isTrialing = billingStatus?.subscriptionStatus === null && billingStatus?.trialDaysRemaining !== null && billingStatus.trialDaysRemaining > 0;
  const trialDays = billingStatus?.trialDaysRemaining ?? 0;

  return (
    <main className="min-h-dvh bg-background text-text-primary">
      <div className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display tracking-tight">Settings</h1>
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>
            ← Dashboard
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-card bg-error-faint border border-error text-error text-sm">
            {error}
          </div>
        )}

        {/* Subscription Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-text-primary">Subscription</h2>

          {isLoadingSubscription ? (
            <div className="bg-surface border border-border rounded-card p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-32 bg-border rounded" />
                <div className="h-4 w-48 bg-border rounded" />
                <div className="h-4 w-40 bg-border rounded" />
              </div>
            </div>
          ) : subscription?.hasSubscription ? (
            <div className="bg-surface border border-border rounded-card p-6 space-y-4">
              {/* Status Row */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Plan</p>
                  <p className="font-medium">
                    Caesar in a Year
                    {subscription.priceInterval && (
                      <span className="text-accent ml-2 text-sm">
                        {subscription.priceInterval === "year" ? "Annual" : "Monthly"}
                      </span>
                    )}
                  </p>
                  {subscription.priceAmount && subscription.priceInterval && (
                    <p className="text-sm text-text-secondary">
                      {formatCurrency(subscription.priceAmount)}/{subscription.priceInterval}
                      {subscription.priceInterval === "year" && (
                        <span className="text-text-muted ml-1">
                          ({formatCurrency(subscription.priceAmount / 12)}/month)
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <StatusBadge status={subscription.status} cancelAtPeriodEnd={subscription.cancelAtPeriodEnd} />
              </div>

              {/* Billing Cycle */}
              {subscription.currentPeriodEnd && (
                <div>
                  <p className="text-sm text-text-muted">
                    {subscription.cancelAtPeriodEnd ? "Access until" : "Next billing date"}
                  </p>
                  <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                </div>
              )}

              {/* Payment Method */}
              {subscription.paymentMethod && (
                <div>
                  <p className="text-sm text-text-muted">Payment method</p>
                  <p className="font-medium">
                    {capitalizeFirst(subscription.paymentMethod.brand)} ending in {subscription.paymentMethod.last4}
                    <span className="text-text-secondary ml-2">
                      (expires {subscription.paymentMethod.expMonth}/{subscription.paymentMethod.expYear})
                    </span>
                  </p>
                </div>
              )}

              {/* Past Due Warning */}
              {subscription.status === "past_due" && (
                <div className="p-3 rounded-card bg-error-faint border border-error">
                  <p className="text-sm text-error font-medium">Payment failed</p>
                  <p className="text-sm text-text-secondary">
                    Please update your payment method to avoid losing access.
                  </p>
                </div>
              )}

              {/* Canceled Notice */}
              {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                <div className="p-3 rounded-card bg-warning-faint border border-warning">
                  <p className="text-sm text-warning font-medium">Subscription canceled</p>
                  <p className="text-sm text-text-secondary">
                    You still have access until {formatDate(subscription.currentPeriodEnd)}.
                    Click "Manage Subscription" to resume.
                  </p>
                </div>
              )}

              {/* Upgrade nudge for monthly subscribers */}
              {subscription.priceInterval === "month" && !subscription.cancelAtPeriodEnd && (
                <div className="p-3 rounded-card bg-accent-faint border border-accent">
                  <p className="text-sm text-accent font-medium">Save with Annual</p>
                  <p className="text-sm text-text-secondary">
                    Switch to annual billing and save $60/year ($119.88/year).
                  </p>
                </div>
              )}

              {/* Manage Button */}
              <Button
                variant="secondary"
                onClick={handleManageSubscription}
                isLoading={isOpeningPortal}
                disabled={isOpeningPortal}
                className="w-full"
              >
                Manage Subscription
              </Button>
            </div>
          ) : isTrialing ? (
            <div className="bg-surface border border-border rounded-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Status</p>
                  <p className="font-medium">Free Trial</p>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-accent-faint text-accent">
                  {trialDays} {trialDays === 1 ? "day" : "days"} left
                </span>
              </div>
              <p className="text-sm text-text-secondary">
                Subscribe before your trial ends to keep your progress and continue learning.
              </p>
              <Button
                variant="primary"
                onClick={() => router.push("/subscribe")}
                className="w-full"
              >
                Subscribe Now
              </Button>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-card p-6 space-y-4">
              <p className="text-text-secondary">No active subscription.</p>
              <Button
                variant="primary"
                onClick={() => router.push("/subscribe")}
                className="w-full"
              >
                Subscribe
              </Button>
            </div>
          )}
        </section>

        {/* Billing History Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-text-primary">Billing History</h2>

          {isLoadingInvoices ? (
            <div className="bg-surface border border-border rounded-card p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-full bg-border rounded" />
                <div className="h-4 w-full bg-border rounded" />
                <div className="h-4 w-3/4 bg-border rounded" />
              </div>
            </div>
          ) : invoices.length > 0 ? (
            <div className="bg-surface border border-border rounded-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-sm font-medium text-text-muted p-4">Date</th>
                    <th className="text-left text-sm font-medium text-text-muted p-4">Amount</th>
                    <th className="text-left text-sm font-medium text-text-muted p-4">Status</th>
                    <th className="text-right text-sm font-medium text-text-muted p-4">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border last:border-b-0">
                      <td className="p-4 text-sm">{formatDate(invoice.date)}</td>
                      <td className="p-4 text-sm">{formatCurrency(invoice.amount)}</td>
                      <td className="p-4 text-sm">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs",
                          invoice.status === "paid"
                            ? "bg-success-faint text-success"
                            : "bg-warning-faint text-warning"
                        )}>
                          {capitalizeFirst(invoice.status ?? "unknown")}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-right">
                        {invoice.invoicePdf && (
                          <a
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:text-accent-hover underline"
                          >
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-card p-6">
              <p className="text-text-secondary text-sm">No billing history yet.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
