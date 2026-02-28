import { GoogleGenAI, type Schema } from "@google/genai";
import { CircuitBreaker } from "@/lib/ai/circuitBreaker";
import { GradeStatus, type GradingResult } from "@/lib/data/types";

// === Config ===
export const MODEL_NAME = "gemini-3-flash-preview";
export const TIMEOUT_MS = 60000; // 60s - generous for reliability
export const RETRY_BACKOFF_MS = 300;
export const MAX_ATTEMPTS = 3;

// === Circuit Breaker ===
// State machine: CLOSED -> OPEN (after 5 failures) -> HALF_OPEN (after 60s)
// HALF_OPEN: single trial call - success -> CLOSED, failure -> OPEN
// See docs/architecture/grading-flow.md for full diagram
const circuitBreaker = new CircuitBreaker({
  name: "grading-utils",
  threshold: 5,
  resetMs: 60000,
});

export function isCircuitOpen(): boolean {
  return circuitBreaker.isOpen();
}

export function recordSuccess() {
  circuitBreaker.recordSuccess();
}

export function recordFailure() {
  circuitBreaker.recordFailure();
}

// === Gemini Client ===
let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return null;
  }

  const heliconeApiKey = process.env.HELICONE_API_KEY;
  // Disable SDK-internal retries (default: 5 attempts via p-retry).
  // callWithRetry handles retries at the application layer; nested retries
  // would cause exponential growth (up to 3 × 5 = 15 total attempts per call).
  cachedClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      retryOptions: { attempts: 1 },
      ...(heliconeApiKey && {
        baseUrl: 'https://gateway.helicone.ai',
        headers: {
          'Helicone-Auth': `Bearer ${heliconeApiKey}`,
          'Helicone-Target-Url': 'https://generativelanguage.googleapis.com',
          'Helicone-Property-Product': 'caesar-in-a-year',
          'Helicone-Property-Environment': process.env.NODE_ENV ?? 'development',
        },
      }),
    },
  });
  return cachedClient;
}

// === Retry with Timeout ===
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxAttempts?: number; backoffMs?: number; timeoutMs?: number }
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? MAX_ATTEMPTS;
  const backoffMs = opts?.backoffMs ?? RETRY_BACKOFF_MS;
  const timeoutMs = opts?.timeoutMs ?? TIMEOUT_MS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeoutMs)
        ),
      ]);
      return result;
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  }

  throw new Error("Failed after retries");
}

// === Grading Helper ===
export interface GradeOptions<T> {
  prompt: string;
  schema: Schema;
  fallbackMessage: string;
  fallbackCorrection?: string;
}

export async function gradeWithAI<T extends GradingResult>(
  options: GradeOptions<T>
): Promise<T> {
  if (isCircuitOpen()) {
    console.warn("Circuit breaker open - skipping AI call");
    return {
      status: GradeStatus.PARTIAL,
      feedback: options.fallbackMessage,
      correction: options.fallbackCorrection,
    } as T;
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      status: GradeStatus.PARTIAL,
      feedback: options.fallbackMessage,
      correction: options.fallbackCorrection,
    } as T;
  }

  try {
    const response = await callWithRetry(async () => {
      return ai.models.generateContent({
        model: MODEL_NAME,
        contents: options.prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: options.schema,
          temperature: 0, // Faster than 0.3 for deterministic output
        },
      });
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    const result = JSON.parse(text) as T;
    recordSuccess();
    return result;
  } catch (error) {
    console.error("AI grading failed:", error);
    recordFailure();
    return {
      status: GradeStatus.PARTIAL,
      feedback: options.fallbackMessage,
      correction: options.fallbackCorrection,
    } as T;
  }
}

// === Fallback Messages ===
// ADR 0003: standard message when AI grading is unavailable (rate limit, circuit breaker, etc.)
export const AI_UNAVAILABLE_FEEDBACK =
  "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.";

// === Lightweight Result Types ===
export interface SimpleGradingResult {
  status: GradeStatus;
  feedback: string;
  hint?: string;
}
