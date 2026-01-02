import { Type } from "@google/genai";
import { GradeStatus } from "@/lib/data/types";
import { gradeWithAI, type SimpleGradingResult } from "./grading-utils";

// Lightweight schema for fast vocab grading
const vocabGradingSchema = {
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
 * Grade a vocabulary answer using AI.
 * All vocab questions are meaning-focused (latin_to_english).
 */
export async function gradeVocab(input: {
  latinWord: string;
  meaning: string; // expected meaning
  question: string;
  userAnswer: string;
}): Promise<SimpleGradingResult> {
  // Input validation
  if (!input.userAnswer?.trim()) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Please provide an answer.",
    };
  }

  if (input.userAnswer.length > 500) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Answer is too long.",
    };
  }

  const prompt = constructVocabPrompt(input);

  return gradeWithAI<SimpleGradingResult>({
    prompt,
    schema: vocabGradingSchema,
    fallbackMessage: "Couldn't check your answer. Compare with the expected meaning.",
  });
}

function constructVocabPrompt(input: {
  latinWord: string;
  meaning: string;
  question: string;
  userAnswer: string;
}): string {
  return `Grade Latin vocab (meaning) answer.

WORD: "${input.latinWord}"
EXPECTED: "${input.meaning}"
STUDENT: "${input.userAnswer}"

CRITERIA:
• CORRECT: Meaning matches (minor wording OK)
• PARTIAL: Close but imprecise
• INCORRECT: Wrong meaning

OUTPUT:
• feedback: 1 sentence max
• hint: only if incorrect, memory aid for word`;
}
