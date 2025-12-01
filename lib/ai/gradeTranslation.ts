import { GoogleGenAI, Type } from "@google/genai";
import { GradeStatus, GradingResult } from "@/types";

const MODEL_NAME = "gemini-2.5-flash";
const TIMEOUT_MS = 5000;
const RETRY_BACKOFF_MS = 500;
const MAX_ATTEMPTS = 2;

// Structured output schema for Gemini
const gradingSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: [GradeStatus.CORRECT, GradeStatus.PARTIAL, GradeStatus.INCORRECT],
    },
    feedback: {
      type: Type.STRING,
    },
    correction: {
      type: Type.STRING,
    },
  },
  required: ["status", "feedback"],
};

// Circuit breaker state (in-memory for this instance)
let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 5;
const OPEN_CIRCUIT_RESET_MS = 60000;
let lastFailureTime = 0;

function isCircuitOpen(): boolean {
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    if (Date.now() - lastFailureTime > OPEN_CIRCUIT_RESET_MS) {
      return false; // Half-open: try again
    }
    return true;
  }
  return false;
}

function recordSuccess() {
  consecutiveFailures = 0;
}

function recordFailure() {
  consecutiveFailures++;
  lastFailureTime = Date.now();
}

/**
 * Grade a user's Latin translation using Gemini AI.
 *
 * Deep module: handles all complexity internally (circuit breaker, retry,
 * timeout, fallback). Caller just provides input and gets a result.
 */
export async function gradeTranslation(input: {
  latin: string;
  userTranslation: string;
  reference: string;
  context?: string;
}): Promise<GradingResult> {
  // Input validation
  if (!input.userTranslation?.trim()) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Please provide a translation.",
    };
  }

  if (input.userTranslation.length > 1000) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Translation is too long.",
    };
  }

  // Circuit breaker check
  if (isCircuitOpen()) {
    console.warn("Circuit breaker open - skipping AI call");
    return getFallbackResult(input.reference);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return getFallbackResult(input.reference);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = constructPrompt(input);

    // Retry loop with backoff
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const responsePromise = ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: gradingSchema,
            temperature: 0.3,
          },
        });

        // Timeout wrapper
        const response = await Promise.race([
          responsePromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS)
          ),
        ]);

        const text = response.text;
        if (!text) throw new Error("Empty response from AI");

        const result = JSON.parse(text) as GradingResult;
        recordSuccess();
        return result;
      } catch (e) {
        if (attempt === MAX_ATTEMPTS - 1) throw e;
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      }
    }

    throw new Error("Failed after retries");
  } catch (error) {
    console.error("Grading failed:", error);
    recordFailure();
    return getFallbackResult(input.reference);
  }
}

function getFallbackResult(reference: string): GradingResult {
  return {
    status: GradeStatus.PARTIAL,
    feedback:
      "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.",
    correction: reference,
  };
}

function constructPrompt(input: {
  latin: string;
  userTranslation: string;
  reference: string;
  context?: string;
}): string {
  return `
You are a supportive but rigorous Latin tutor.
Analyze the student's translation of a Latin sentence.

Latin: "${input.latin}"
Reference: "${input.reference}"
Context: ${input.context || "None"}

Student Input: "${input.userTranslation}"

Task:
1. Determine if the student understood the core meaning (Subject, Object, Verb).
2. Be forgiving of synonyms.
3. Be strict on grammar relationships.
4. Return JSON with status (CORRECT, PARTIAL, INCORRECT), helpful feedback, and optional correction.
`;
}
