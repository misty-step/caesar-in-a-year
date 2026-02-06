import { NextResponse } from "next/server";

type ServiceStatus = "ok" | "degraded" | "down" | "unconfigured";

interface HealthCheck {
  service: string;
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: ServiceStatus;
  timestamp: string;
  checks: HealthCheck[];
}

/**
 * Health check endpoint for deployment verification and monitoring.
 *
 * Returns:
 * - 200 with status "ok" if all services are healthy
 * - 200 with status "degraded" if optional services are down
 * - 503 with status "down" if critical services are unreachable
 *
 * Usage:
 * - Post-deployment verification: curl https://caesarinayear.com/api/health
 * - Monitoring: Alert if status != "ok"
 */
export async function GET() {
  const checks = await Promise.all([
    checkClerk(),
    checkStripe(),
    checkConvex(),
    checkGemini(),
  ]);

  // Determine overall status
  // Critical services: Clerk, Stripe, Convex
  // Optional services: Gemini (has graceful fallback)
  const criticalServices = ["clerk", "stripe", "convex"];
  const criticalDown = checks
    .filter((c) => criticalServices.includes(c.service))
    .some((c) => c.status === "down");

  const anyDegraded = checks.some(
    (c) => c.status === "degraded" || c.status === "unconfigured"
  );

  const overall: ServiceStatus = criticalDown
    ? "down"
    : anyDegraded
      ? "degraded"
      : "ok";

  const response: HealthResponse = {
    status: overall,
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(response, {
    status: overall === "down" ? 503 : 200,
  });
}

async function checkClerk(): Promise<HealthCheck> {
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    return { service: "clerk", status: "unconfigured" };
  }

  const start = Date.now();
  try {
    // Use Clerk's JWKS endpoint as a lightweight health check
    // This verifies the secret key is valid without making authenticated calls
    const res = await fetch("https://api.clerk.com/v1/jwks", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    return {
      service: "clerk",
      status: res.ok ? "ok" : "degraded",
      latencyMs: Date.now() - start,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (e) {
    return {
      service: "clerk",
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkStripe(): Promise<HealthCheck> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return { service: "stripe", status: "unconfigured" };
  }

  const start = Date.now();
  try {
    // Retrieve balance as a lightweight health check
    const res = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    return {
      service: "stripe",
      status: res.ok ? "ok" : "degraded",
      latencyMs: Date.now() - start,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (e) {
    return {
      service: "stripe",
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkConvex(): Promise<HealthCheck> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!convexUrl) {
    return { service: "convex", status: "unconfigured" };
  }

  const start = Date.now();
  try {
    // Check if Convex deployment is reachable
    // The URL pattern is https://xxx.convex.cloud
    const res = await fetch(convexUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });

    // Convex returns various status codes, but should be reachable
    return {
      service: "convex",
      status: res.status < 500 ? "ok" : "degraded",
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    return {
      service: "convex",
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkGemini(): Promise<HealthCheck> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Gemini is optional - graceful fallback exists
    return { service: "gemini", status: "unconfigured" };
  }

  const start = Date.now();
  try {
    // List models as a lightweight health check
    // API key in header, not URL (security: URLs appear in logs)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models`,
      {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(5000),
      }
    );

    return {
      service: "gemini",
      status: res.ok ? "ok" : "degraded",
      latencyMs: Date.now() - start,
      ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
    };
  } catch (e) {
    return {
      service: "gemini",
      status: "down",
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
