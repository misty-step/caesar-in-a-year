"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/UI/Button";

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "true";

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billingStatus = useQuery(api.billing.getStatus);

  // Redirect to dashboard if user already has access
  useEffect(() => {
    if (billingStatus?.hasAccess) {
      router.push("/dashboard");
    }
  }, [billingStatus?.hasAccess, router]);

  // Show loading state while redirecting
  if (billingStatus?.hasAccess) {
    return null;
  }

  const handleSubscribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  const isReturningUser = billingStatus?.trialEndsAt && billingStatus.trialDaysRemaining === 0;

  return (
    <main className="min-h-dvh bg-background text-text-primary">
      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-display tracking-tight mb-4">
            {isReturningUser ? "Salve, Discipule!" : "Continue Your Journey"}
          </h1>
          <p className="text-text-secondary text-lg">
            {isReturningUser
              ? "Welcome back! Your progress is safe. Subscribe to continue reading Caesar."
              : "Your trial has ended. Subscribe to keep learning Latin with Caesar."}
          </p>
        </div>

        {/* Canceled notice */}
        {canceled && (
          <div className="mb-8 p-4 rounded-card bg-warning-faint border border-warning text-warning text-center">
            Checkout was canceled. Ready when you are.
          </div>
        )}

        {/* Pricing card */}
        <div className="bg-surface border border-border rounded-card p-8 mb-8">
          <div className="text-center mb-6">
            <div className="text-4xl font-display mb-2">
              $14.99<span className="text-lg text-text-muted">/month</span>
            </div>
            <p className="text-text-secondary">
              Full access to Caesar in a Year
            </p>
          </div>

          <ul className="space-y-3 mb-8">
            {[
              "Daily guided Latin sessions",
              "AI-powered translation feedback",
              "Spaced repetition for retention",
              "Progress preserved forever",
              "Cancel anytime",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <svg
                  className="size-5 text-success shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-text-secondary">{feature}</span>
              </li>
            ))}
          </ul>

          {error && (
            <div className="mb-4 p-3 rounded-card bg-error-faint border border-error text-error text-sm text-center">
              {error}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSubscribe}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? "Redirecting to checkout..." : "Subscribe Now"}
          </Button>

          <p className="text-xs text-text-muted text-center mt-4">
            Secure checkout powered by Stripe. No auto-renewal surprises.
          </p>
        </div>

        {/* Back link */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
          >
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<SubscribeLoading />}>
      <SubscribeContent />
    </Suspense>
  );
}

function SubscribeLoading() {
  return (
    <main className="min-h-dvh bg-background text-text-primary">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center">
          <div className="h-8 w-48 bg-surface animate-pulse rounded mx-auto mb-4" />
          <div className="h-4 w-64 bg-surface animate-pulse rounded mx-auto" />
        </div>
      </div>
    </main>
  );
}
