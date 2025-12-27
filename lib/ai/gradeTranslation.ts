import { GoogleGenAI, Type } from "@google/genai";
import { GradeStatus, type GradingResult, type AttemptHistoryEntry } from "@/lib/data/types";

const MODEL_NAME = "gemini-3-flash-preview";
const TIMEOUT_MS = 20000; // 20s - covers Gemini cold start latency
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
    analysis: {
      type: Type.OBJECT,
      properties: {
        userTranslationLiteral: {
          type: Type.STRING,
        },
        errors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ['grammar', 'vocabulary', 'word_order', 'omission', 'other'],
              },
              latinSegment: {
                type: Type.STRING,
              },
              explanation: {
                type: Type.STRING,
              },
            },
            required: ['type', 'explanation'],
          },
        },
        glossary: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              meaning: { type: Type.STRING },
            },
            required: ['word', 'meaning'],
          },
        },
      },
      required: ['errors'],
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
  attemptHistory?: AttemptHistoryEntry[];
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

function formatHistoryForPrompt(history: AttemptHistoryEntry[]): string {
  if (!history || history.length === 0) return "";

  const lines = history.map((h, i) => {
    const date = new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const errors = h.errorTypes.length > 0 ? ` - errors: [${h.errorTypes.join(', ')}]` : '';
    return `- Attempt ${history.length - i} (${date}): ${h.gradingStatus}${errors}`;
  });

  return `
STUDENT HISTORY FOR THIS SENTENCE:
${lines.join('\n')}
Current attempt is #${history.length + 1}.
`;
}

function getEscalationInstructions(attemptCount: number): string {
  if (attemptCount === 0) {
    return ""; // First attempt: standard feedback
  }
  if (attemptCount === 1) {
    return `
ADAPTATION: This is the student's 2nd attempt. Reference their previous mistake if relevant.
Be slightly more detailed in your explanations.`;
  }
  // 3+ attempts
  return `
ADAPTATION: This is attempt #${attemptCount + 1}. The student has struggled with this sentence multiple times.
- Provide thorough, hand-holding explanations
- Include memory aids or mnemonics where helpful
- Break down the grammar step by step
- Be extra encouraging while still being rigorous`;
}

function constructPrompt(input: {
  latin: string;
  userTranslation: string;
  reference: string;
  context?: string;
  attemptHistory?: AttemptHistoryEntry[];
}): string {
  const historySection = formatHistoryForPrompt(input.attemptHistory ?? []);
  const escalationSection = getEscalationInstructions(input.attemptHistory?.length ?? 0);

  return `
You are a supportive but rigorous Latin tutor helping a student learn to read Caesar.
Analyze the student's translation of a Latin sentence.

Latin: "${input.latin}"
Reference Translation: "${input.reference}"
Context: ${input.context || "None"}
Student's Translation: "${input.userTranslation}"
${historySection}
GRADING CRITERIA:
- CORRECT: Core meaning captured (S-V-O relationships correct), minor word choice differences OK
- PARTIAL: Some understanding shown but key elements wrong or missing
- INCORRECT: Fundamental misunderstanding or completely off-topic
${escalationSection}
ANALYSIS REQUIREMENTS:
1. Provide a brief, encouraging feedback summary (1-2 sentences)
2. If not CORRECT, explain what the student's translation literally means vs what the Latin says
3. List specific errors with:
   - type: grammar | vocabulary | word_order | omission | other
   - latinSegment: the Latin word/phrase involved
   - explanation: what it means and why the student's version was wrong
4. Provide a glossary with EVERY individual Latin word → English meaning (one entry per word, no phrases)

Be specific and pedagogical. Help the student understand WHY their translation was wrong and WHAT each Latin word means.

Return JSON with: status, feedback, correction (reference translation), analysis (userTranslationLiteral, errors[], glossary{})
`;
}
