import { Type } from "@google/genai";
import { GradeStatus } from "@/lib/data/types";
import { gradeWithAI, type SimpleGradingResult } from "./grading-utils";

// Lightweight schema for fast phrase grading
const phraseGradingSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: [GradeStatus.CORRECT, GradeStatus.PARTIAL, GradeStatus.INCORRECT],
    },
    feedback: { type: Type.STRING },
    hint: { type: Type.STRING },
  },
  required: ["status", "feedback"],
};

/**
 * Grade a phrase translation using AI.
 * Lightweight grading for multi-word Latin phrases.
 */
export async function gradePhrase(input: {
  latin: string; // 2-4 word Latin phrase
  english: string; // expected translation
  userAnswer: string;
  context?: string;
}): Promise<SimpleGradingResult> {
  // Input validation
  if (!input.userAnswer?.trim()) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Please provide a translation.",
    };
  }

  if (input.userAnswer.length > 500) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Translation is too long.",
    };
  }

  const prompt = constructPhrasePrompt(input);

  return gradeWithAI<SimpleGradingResult>({
    prompt,
    schema: phraseGradingSchema,
    fallbackMessage: "Couldn't check your translation. Compare with the expected answer.",
  });
}

function constructPhrasePrompt(input: {
  latin: string;
  english: string;
  userAnswer: string;
  context?: string;
}): string {
  return `Grade Latin phrase translation.

LATIN: "${input.latin}"
EXPECTED: "${input.english}"
STUDENT: "${input.userAnswer}"
${input.context ? `CONTEXT: ${input.context}` : ''}

CRITERIA:
• CORRECT: Meaning captured (minor wording OK)
• PARTIAL: Core meaning but key word wrong
• INCORRECT: Wrong meaning or relationship

OUTPUT:
• feedback: 1 sentence max
• hint: only if incorrect, explain what Latin actually says`;
}
