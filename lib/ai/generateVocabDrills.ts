import { GoogleGenAI, Type } from "@google/genai";
import type { GradingResult, AttemptHistoryEntry, VocabCard } from "@/lib/data/types";

const MODEL_NAME = "gemini-3-flash-preview";
const TIMEOUT_MS = 15000;

// Schema for vocab drill generation
const vocabDrillSchema = {
  type: Type.OBJECT,
  properties: {
    drills: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          latinWord: { type: Type.STRING },
          meaning: { type: Type.STRING },
          questionType: {
            type: Type.STRING,
            enum: ['latin_to_english', 'form_identification', 'context_fill'],
          },
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
        },
        required: ['latinWord', 'meaning', 'questionType', 'question', 'answer'],
      },
    },
  },
  required: ['drills'],
};

type VocabDrillInput = {
  latin: string;
  sentenceId: string;
  gradingResult: GradingResult;
  attemptHistory?: AttemptHistoryEntry[];
};

type VocabDrillOutput = Omit<VocabCard, 'id'>[];

/**
 * Determine if vocab drill generation should be triggered.
 *
 * Triggers:
 * 1. 3+ INCORRECT attempts on same sentence
 * 2. Same word appears in vocab errors across 2+ sentences (not implemented yet - would need cross-sentence history)
 */
export function shouldGenerateVocabDrills(
  gradingResult: GradingResult,
  attemptHistory?: AttemptHistoryEntry[]
): boolean {
  // Don't generate for correct answers
  if (gradingResult.status === 'CORRECT') {
    return false;
  }

  // Check attempt count
  const incorrectCount = (attemptHistory ?? [])
    .filter(h => h.gradingStatus === 'INCORRECT')
    .length;

  // Current attempt is also incorrect (since we already checked status)
  // So if we have 2+ previous incorrects, this makes 3+
  if (incorrectCount >= 2) {
    return true;
  }

  // Also trigger if there are vocabulary-specific errors
  const vocabErrors = gradingResult.analysis?.errors?.filter(e => e.type === 'vocabulary') ?? [];
  if (vocabErrors.length >= 2 && incorrectCount >= 1) {
    return true;
  }

  return false;
}

/**
 * Generate targeted vocabulary drills for words the student struggled with.
 *
 * Uses AI to create pedagogically effective questions based on the specific
 * errors in the grading result.
 */
export async function generateVocabDrills(input: VocabDrillInput): Promise<VocabDrillOutput> {
  const { latin, sentenceId, gradingResult } = input;

  // Extract vocabulary-related errors
  const vocabErrors = gradingResult.analysis?.errors?.filter(
    e => e.type === 'vocabulary' && e.latinSegment
  ) ?? [];

  // Also include omission errors as they often indicate vocabulary gaps
  const omissionErrors = gradingResult.analysis?.errors?.filter(
    e => e.type === 'omission' && e.latinSegment
  ) ?? [];

  const targetWords = [...vocabErrors, ...omissionErrors]
    .map(e => e.latinSegment!)
    .filter((v, i, a) => a.indexOf(v) === i); // dedupe

  if (targetWords.length === 0) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set for vocab drill generation");
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = constructVocabPrompt(latin, targetWords, gradingResult);

    const responsePromise = ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: vocabDrillSchema,
        temperature: 0.4,
      },
    });

    const response = await Promise.race([
      responsePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS)
      ),
    ]);

    const text = response.text;
    if (!text) {
      console.error("Empty response from vocab drill AI");
      return [];
    }

    const result = JSON.parse(text) as { drills: VocabDrillOutput };

    // Add sentenceId to each drill
    return result.drills.map(drill => ({
      ...drill,
      sourceSentenceId: sentenceId,
    }));
  } catch (error) {
    console.error("Vocab drill generation failed:", error);
    return [];
  }
}

function constructVocabPrompt(
  latin: string,
  targetWords: string[],
  gradingResult: GradingResult
): string {
  const errorsContext = gradingResult.analysis?.errors
    ?.filter(e => targetWords.includes(e.latinSegment ?? ''))
    .map(e => `- ${e.latinSegment}: ${e.explanation}`)
    .join('\n') ?? '';

  return `
You are a Latin vocabulary tutor. A student struggled with these Latin words in a sentence.

SENTENCE: "${latin}"

TARGET WORDS (student got these wrong):
${targetWords.map(w => `- ${w}`).join('\n')}

CONTEXT OF ERRORS:
${errorsContext}

Generate 1-2 vocabulary drills for the most important words the student needs to learn.

DRILL TYPES:
1. latin_to_english: "What does '[word]' mean?" → Answer: the English meaning
2. form_identification: "What form is '[word]'?" → Answer: grammatical description (e.g., "3rd person plural perfect active indicative")
3. context_fill: Sentence with blank → Answer: the correct Latin word

REQUIREMENTS:
- Focus on the words that caused the most confusion
- For verbs, prefer form_identification to help with conjugation
- For nouns/adjectives, prefer latin_to_english
- Make answers concise but complete
- latinWord should be the dictionary form (nominative singular for nouns, infinitive for verbs)
- meaning should be a clear, simple definition

Return JSON with: drills[] containing latinWord, meaning, questionType, question, answer
`;
}
