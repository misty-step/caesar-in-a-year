import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GradingResult, GradeStatus } from '../types';

// Grading Schema
const gradingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: [GradeStatus.CORRECT, GradeStatus.PARTIAL, GradeStatus.INCORRECT],
      description: "The evaluation status of the user's translation."
    },
    feedback: {
      type: Type.STRING,
      description: "Helpful feedback explaining why it is correct or incorrect. Keep it encouraging but precise.",
    },
    correction: {
      type: Type.STRING,
      description: "The ideal translation if the user was wrong.",
    }
  },
  required: ["status", "feedback"],
};

export const gradeTranslation = async (
  latin: string,
  userTranslation: string,
  reference: string,
  context?: string
): Promise<GradingResult> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    return {
      status: GradeStatus.INCORRECT,
      feedback: "System Error: API Key missing. Please check configuration.",
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a supportive but rigorous Latin tutor for an adult autodidact.
    Your goal is to check if the student understands the *meaning* of the Latin sentence.
    
    Latin Sentence: "${latin}"
    Context/Notes: ${context || 'None'}
    Reference Meaning: "${reference}"
    
    Student's Answer: "${userTranslation}"
    
    Task:
    1. Determine if the student grasped the core meaning.
    2. Be forgiving of synonyms (e.g., "house" vs "villa").
    3. Be strict on grammatical relationships (Subject vs Object).
    4. Provide feedback.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: gradingSchema,
        systemInstruction: "You are CaesarAI, a Latin tutor."
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as GradingResult;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      status: GradeStatus.PARTIAL,
      feedback: "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.",
      correction: reference
    };
  }
};