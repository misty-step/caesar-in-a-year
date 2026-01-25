/**
 * Environment configuration validation
 *
 * Fail-fast pattern: validates all required environment variables at startup
 * with actionable error messages instead of cryptic runtime failures.
 *
 * Call once from app/layout.tsx (server-side only).
 */

type EnvRequirement = {
  key: string;
  pattern?: RegExp;
  required: boolean;
  hint: string;
};

/**
 * Environment variables required for the app to function.
 * Each entry includes a format pattern and a hint for fixing.
 */
const REQUIRED_ENV: EnvRequirement[] = [
  // Clerk (client + server)
  {
    key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    pattern: /^pk_(test|live)_/,
    required: true,
    hint: "Get from Clerk Dashboard → API Keys",
  },
  {
    key: "CLERK_SECRET_KEY",
    pattern: /^sk_(test|live)_/,
    required: true,
    hint: "Get from Clerk Dashboard → API Keys",
  },

  // Stripe
  {
    key: "STRIPE_SECRET_KEY",
    pattern: /^sk_(test|live)_/,
    required: true,
    hint: "Get from Stripe Dashboard → API Keys",
  },
  {
    key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    pattern: /^pk_(test|live)_/,
    required: true,
    hint: "Get from Stripe Dashboard → API Keys",
  },
  {
    key: "STRIPE_PRICE_ID",
    pattern: /^price_/,
    required: true,
    hint: "Create monthly price in Stripe Dashboard → Products",
  },
  {
    key: "STRIPE_PRICE_ID_ANNUAL",
    pattern: /^price_/,
    required: false, // Optional - annual plan may not be configured yet
    hint: "Create annual price in Stripe Dashboard → Products",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    pattern: /^whsec_/,
    required: true,
    hint: "Get from Stripe Dashboard → Webhooks → Signing secret",
  },

  // Convex
  {
    key: "NEXT_PUBLIC_CONVEX_URL",
    pattern: /^https:\/\/.+\.convex\.cloud$/,
    required: true,
    hint: "Get from Convex Dashboard → Settings → Deployment URL",
  },
  {
    key: "CONVEX_WEBHOOK_SECRET",
    pattern: /^[a-f0-9]{32,}$|^[A-Za-z0-9+/=]{24,}$/, // Hex (32+) or Base64 (24+)
    required: true,
    hint: "Generate with: openssl rand -hex 32. Must match Vercel AND Convex.",
  },
  // App URL (required for Stripe redirects)
  {
    key: "NEXT_PUBLIC_APP_URL",
    pattern: /^https?:\/\/.+/,
    required: process.env.NODE_ENV === "production",
    hint: "Set to your production URL (e.g., https://caesarinayear.com)",
  },

  // Gemini (optional - graceful fallback exists)
  {
    key: "GEMINI_API_KEY",
    pattern: /^AI/,
    required: false,
    hint: "Get from Google AI Studio. Optional - grading falls back to basic mode.",
  },
];

/**
 * Validates that all required environment variables are set and properly formatted.
 * Throws immediately with a clear, actionable error message if validation fails.
 *
 * @throws Error with detailed message listing all configuration issues
 */
export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of REQUIRED_ENV) {
    const value = process.env[req.key];

    // Check existence
    if (!value) {
      if (req.required) {
        errors.push(`❌ Missing: ${req.key}\n   → ${req.hint}`);
      } else {
        warnings.push(`⚠️  Optional: ${req.key} not set\n   → ${req.hint}`);
      }
      continue;
    }

    // Check for trailing whitespace (common cause of cryptic errors)
    if (value !== value.trim()) {
      errors.push(
        `❌ Trailing whitespace in ${req.key}\n` +
          `   This causes cryptic "Invalid character" errors.\n` +
          `   Re-set the variable without trailing newlines.`
      );
      continue;
    }

    // Check format pattern
    if (req.pattern && !req.pattern.test(value)) {
      const preview = value.slice(0, 12) + (value.length > 12 ? "..." : "");
      errors.push(
        `❌ Invalid format: ${req.key}\n` +
          `   Expected: ${req.pattern}\n` +
          `   Got: ${preview}\n` +
          `   → ${req.hint}`
      );
    }
  }

  // Check for test/live mode consistency
  const stripeSecretMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")
    ? "test"
    : "live";
  const stripePubMode =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
      ? "test"
      : "live";

  if (
    process.env.STRIPE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    stripeSecretMode !== stripePubMode
  ) {
    errors.push(
      `❌ Stripe mode mismatch\n` +
        `   Secret key: ${stripeSecretMode}\n` +
        `   Publishable key: ${stripePubMode}\n` +
        `   Both must be test or both must be live.`
    );
  }

  // Log warnings but don't fail
  if (warnings.length > 0) {
    console.warn(
      `\n${"─".repeat(60)}\n` +
        `Configuration Warnings\n` +
        `${"─".repeat(60)}\n\n` +
        warnings.join("\n\n") +
        `\n\n${"─".repeat(60)}\n`
    );
  }

  // Throw on errors
  if (errors.length > 0) {
    throw new Error(
      `\n${"═".repeat(60)}\n` +
        `CONFIGURATION ERROR - App cannot start\n` +
        `${"═".repeat(60)}\n\n` +
        errors.join("\n\n") +
        `\n\n${"═".repeat(60)}\n` +
        `Run ./scripts/verify-env.sh for full diagnostics\n` +
        `${"═".repeat(60)}\n`
    );
  }
}

/**
 * Check if we're in a server context where validation should run.
 * Skip validation in:
 * - Client-side rendering
 * - Build time (some vars may not be available)
 */
export function shouldValidate(): boolean {
  // Client-side: skip
  if (typeof window !== "undefined") {
    return false;
  }

  // Build time: skip (CI may use placeholder values)
  // Check for common CI indicators
  if (
    process.env.CI === "true" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return false;
  }

  return true;
}

/**
 * Validates config if appropriate for the current context.
 * Safe to call from layout.tsx - will no-op during build.
 */
export function validateConfigIfNeeded(): void {
  if (shouldValidate()) {
    validateConfig();
  }
}
