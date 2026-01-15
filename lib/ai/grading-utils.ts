import { GoogleGenAI, type Schema } from "@google/genai";
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
let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 5;
const OPEN_CIRCUIT_RESET_MS = 60000;
let lastFailureTime = 0;

export function isCircuitOpen(): boolean {
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    if (Date.now() - lastFailureTime > OPEN_CIRCUIT_RESET_MS) {
      return false; // Half-open: try again
    }
    return true;
  }
  return false;
}

export function recordSuccess() {
  consecutiveFailures = 0;
}

export function recordFailure() {
  consecutiveFailures++;
  lastFailureTime = Date.now();
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

  cachedClient = new GoogleGenAI({ apiKey });
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

// === Lightweight Result Types ===
export interface SimpleGradingResult {
  status: GradeStatus;
  feedback: string;
  hint?: string;
}
