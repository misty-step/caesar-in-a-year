import { Type } from "@google/genai";
import { GradeStatus, type GradingResult } from "@/lib/data/types";
import { gradeWithAI } from "./grading-utils";

// Structured output schema - optimized for speed
const gistGradingSchema = {
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
                enum: ['comprehension', 'omission', 'misreading', 'other'],
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

  const prompt = constructGistPrompt(input);

  return gradeWithAI({
    prompt,
    schema: gistGradingSchema,
    fallbackMessage:
      "We couldn't reach the AI tutor right now. Please compare your summary with the reference gist manually.",
    fallbackCorrection: input.referenceGist,
  });
}

function constructGistPrompt(input: {
  latin: string;
  question: string;
  userAnswer: string;
  referenceGist: string;
  context?: string;
}): string {
  return `Latin comprehension tutor grading Caesar passage gist.

LATIN: "${input.latin}"
QUESTION: "${input.question}"
REFERENCE: "${input.referenceGist}"
STUDENT: "${input.userAnswer}"
${input.context ? `CONTEXT: ${input.context}` : ''}

CRITERIA:
• CORRECT: Understood main entities, relationships, central claim
• PARTIAL: Got some elements, missed key points
• INCORRECT: Fundamental misunderstanding

OUTPUT:
• feedback: 1-2 sentences, encouraging
• If not CORRECT: explain what student's answer implies vs what Latin says
• errors[]: type (comprehension|omission|misreading|other), latinSegment, explanation
• glossary[]: key Latin words → meaning`;
}
