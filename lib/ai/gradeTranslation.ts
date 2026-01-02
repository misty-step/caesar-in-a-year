import { Type } from "@google/genai";
import { GradeStatus, type GradingResult, type AttemptHistoryEntry } from "@/lib/data/types";
import { gradeWithAI } from "./grading-utils";

// Structured output schema - optimized for speed
const gradingSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: [GradeStatus.CORRECT, GradeStatus.PARTIAL, GradeStatus.INCORRECT],
    },
    feedback: { type: Type.STRING },
    correction: { type: Type.STRING },
    analysis: {
      type: Type.OBJECT,
      properties: {
        userTranslationLiteral: { type: Type.STRING },
        errors: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ['grammar', 'vocabulary', 'word_order', 'omission', 'other'],
              },
              latinSegment: { type: Type.STRING },
              explanation: { type: Type.STRING },
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

  const prompt = constructPrompt(input);

  return gradeWithAI({
    prompt,
    schema: gradingSchema,
    fallbackMessage:
      "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.",
    fallbackCorrection: input.reference,
  });
}

function formatHistoryForPrompt(history: AttemptHistoryEntry[]): string {
  if (!history || history.length === 0) return "";

  const lines = history.map((h, i) => {
    const date = new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const errors = h.errorTypes.length > 0 ? ` [${h.errorTypes.join(', ')}]` : '';
    return `${history.length - i}. ${date}: ${h.gradingStatus}${errors}`;
  });

  return `\nHISTORY (${history.length} prior attempts):\n${lines.join('\n')}`;
}

function getEscalationLevel(attemptCount: number): string {
  if (attemptCount === 0) return "";
  if (attemptCount === 1) return "\n→ 2nd attempt: reference prior mistake, be slightly more detailed.";
  return `\n→ Attempt #${attemptCount + 1}: thorough explanations, step-by-step grammar, memory aids, be encouraging.`;
}

function constructPrompt(input: {
  latin: string;
  userTranslation: string;
  reference: string;
  context?: string;
  attemptHistory?: AttemptHistoryEntry[];
}): string {
  const historySection = formatHistoryForPrompt(input.attemptHistory ?? []);
  const escalationSection = getEscalationLevel(input.attemptHistory?.length ?? 0);

  return `Latin tutor grading Caesar translation.

LATIN: "${input.latin}"
REFERENCE: "${input.reference}"
STUDENT: "${input.userTranslation}"
${input.context ? `CONTEXT: ${input.context}` : ''}${historySection}

CRITERIA:
• CORRECT: Core meaning correct (S-V-O relationships), minor wording OK
• PARTIAL: Some understanding, key elements wrong/missing
• INCORRECT: Fundamental misunderstanding${escalationSection}

OUTPUT:
• feedback: 1-2 sentences, encouraging
• If not CORRECT: explain what student's translation means vs Latin
• errors[]: type (grammar|vocabulary|word_order|omission|other), latinSegment, explanation
• glossary[]: every Latin word → meaning (individual words only)`;
}
