"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/UI/Button";
import { cn } from "@/lib/design";

interface TrialBannerProps {
  className?: string;
}

/**
 * Trial countdown banner for dashboard.
 *
 * Visibility rules:
 * - Days 1-7: Hidden (let user explore)
 * - Days 8-11: Subtle (dismissible)
 * - Days 12-14: Prominent (non-dismissible)
 * - Subscribed: Hidden
 */
export function TrialBanner({ className }: TrialBannerProps) {
  const router = useRouter();
  const billingStatus = useQuery(api.billing.getStatus);

  // Don't show if loading, not authenticated, or already subscribed
  if (!billingStatus || !billingStatus.isAuthenticated) {
    return null;
  }

  // Don't show for active subscribers
  if (billingStatus.subscriptionStatus === "active") {
    return null;
  }

  // Don't show if no trial (shouldn't happen, but defensive)
  if (billingStatus.trialDaysRemaining === null) {
    return null;
  }

  const daysLeft = billingStatus.trialDaysRemaining;

  // Days 1-7: Don't show
  if (daysLeft > 7) {
    return null;
  }

  // Trial expired
  if (daysLeft === 0) {
    return (
      <div
        className={cn(
          "p-4 rounded-card bg-warning-faint border border-warning",
          className
        )}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-medium text-warning">Your trial has ended</p>
            <p className="text-sm text-text-secondary">
              Subscribe to continue your Latin journey. Your progress is saved.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push("/subscribe")}
          >
            Subscribe
          </Button>
        </div>
      </div>
    );
  }

  // Days 12-14: Prominent
  const isUrgent = daysLeft <= 3;

  return (
    <div
      className={cn(
        "p-4 rounded-card border",
        isUrgent
          ? "bg-warning-faint border-warning"
          : "bg-surface border-border",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p
            className={cn(
              "font-medium",
              isUrgent ? "text-warning" : "text-text-primary"
            )}
          >
            {daysLeft} {daysLeft === 1 ? "day" : "days"} left in your trial
          </p>
          <p className="text-sm text-text-secondary">
            {isUrgent
              ? "Subscribe now to keep your streak alive"
              : "Subscribe to continue after your trial ends"}
          </p>
        </div>
        <Button
          variant={isUrgent ? "primary" : "secondary"}
          size="sm"
          onClick={() => router.push("/subscribe")}
        >
          Subscribe
        </Button>
      </div>
    </div>
  );
}
