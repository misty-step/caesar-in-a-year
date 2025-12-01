import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GradeStatus, GradingResult } from "@/types";

const MODEL_NAME = "gemini-1.5-flash";

const schema = {
  type: SchemaType.OBJECT,
  properties: {
    status: {
      type: SchemaType.STRING,
      enum: [GradeStatus.CORRECT, GradeStatus.PARTIAL, GradeStatus.INCORRECT],
      nullable: false,
    },
    feedback: {
      type: SchemaType.STRING,
      nullable: false,
    },
    correction: {
      type: SchemaType.STRING,
      nullable: true,
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
      // Half-open: try again
      return false;
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

export async function gradeTranslation(input: {
  latin: string;
  userTranslation: string;
  reference: string;
  context?: string;
}): Promise<GradingResult> {
  // 1. Guard inputs
  if (!input.userTranslation || !input.userTranslation.trim()) {
    return {
      status: GradeStatus.INCORRECT,
      feedback: "Please provide a translation.",
    };
  }
  
  if (input.userTranslation.length > 1000) {
      return {
          status: GradeStatus.INCORRECT,
          feedback: "Translation is too long."
      }
  }

  // 2. Circuit Breaker Check
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
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.3,
      },
    });

    const prompt = constructPrompt(input);

    // Retry logic (1 retry)
    let result: GradingResult | null = null;
    
    // Try up to 2 times (1 initial + 1 retry)
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const resultPromise = model.generateContent(prompt);
            
            // Simple timeout wrapper (5s)
            // We cast the race result because Promise.race types are tricky with timeouts
            const response = await Promise.race([
                resultPromise,
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
            ]) as any; // Using any here to bypass the specific GenerateContentResult vs never mismatch cleanly
            
            const text = response.response.text();
            result = JSON.parse(text) as GradingResult;
            break; // Success, exit loop
        } catch (e) {
            if (attempt === 1) throw e; // Rethrow on last attempt
            // Backoff before retry
            await new Promise(r => setTimeout(r, 500)); 
        }
    }

    if (!result) throw new Error("Failed to generate result");

    recordSuccess();
    return result;

  } catch (error) {
    console.error("Grading failed:", error);
    recordFailure();
    return getFallbackResult(input.reference);
  }
}

function getFallbackResult(reference: string): GradingResult {
  return {
    status: GradeStatus.PARTIAL,
    feedback: "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.",
    correction: reference,
  };
}

function constructPrompt(input: { latin: string; userTranslation: string; reference: string; context?: string }): string {
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
