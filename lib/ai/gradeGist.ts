import { GoogleGenAI, Type } from "@google/genai";
import { GradeStatus, type GradingResult } from "@/lib/data/types";

const MODEL_NAME = "gemini-3-flash-preview";
const TIMEOUT_MS = 20000; // 20s - covers Gemini cold start latency
const RETRY_BACKOFF_MS = 500;
const MAX_ATTEMPTS = 2;

// Structured output schema for Gemini
const gistGradingSchema = {
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
 * Grade a user's passage comprehension (gist) using Gemini AI.
 *
 * Deep module: handles all complexity internally (circuit breaker, retry,
 * timeout, fallback). Caller just provides input and gets a result.
 *
 * Unlike gradeTranslation, this judges comprehension/summary quality,
 * not literal translation accuracy.
 */
export async function gradeGist(input: {
  latin: string; // full passage (joined)
  question: string; // gist prompt shown to user
  userAnswer: string; // user summary
  referenceGist: string; // reference summary
  context?: string; // book/chapter/etc
}): Promise<GradingResult> {
  // Input validation
  if (!input.userAnswer?.trim()) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Please provide a summary of the passage.",
    };
  }

  if (input.userAnswer.length > 2000) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Summary is too long.",
    };
  }

  // Circuit breaker check
  if (isCircuitOpen()) {
    console.warn("Circuit breaker open - skipping AI gist grading");
    return getFallbackResult(input.referenceGist);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    return getFallbackResult(input.referenceGist);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = constructGistPrompt(input);

    // Retry loop with backoff
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const responsePromise = ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: gistGradingSchema,
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
    console.error("Gist grading failed:", error);
    recordFailure();
    return getFallbackResult(input.referenceGist);
  }
}

function getFallbackResult(referenceGist: string): GradingResult {
  return {
    status: GradeStatus.PARTIAL,
    feedback:
      "We couldn't reach the AI tutor right now. Please compare your summary with the reference gist manually.",
    correction: referenceGist,
  };
}

function constructGistPrompt(input: {
  latin: string;
  question: string;
  userAnswer: string;
  referenceGist: string;
  context?: string;
}): string {
  return `
You are a supportive Latin comprehension tutor.
Analyze the student's summary/gist of a Latin passage.

Latin Passage: "${input.latin}"
Question: "${input.question}"
Reference Gist: "${input.referenceGist}"
Context: ${input.context || "None"}

Student Summary: "${input.userAnswer}"

Task:
1. Judge comprehension: Did the student identify the main entities, relationships, and central claim?
2. Accept paraphrase and partial credit for getting the essential meaning.
3. Do NOT nitpick grammar or style in their English response.
4. Focus on understanding, not translation accuracy.
5. Return JSON with:
   - status: CORRECT (understood main points), PARTIAL (got some but missed key elements), INCORRECT (major misunderstanding)
   - feedback: 1-3 sentences of actionable feedback
   - correction: (optional) include reference gist if student missed key points
`;
}
