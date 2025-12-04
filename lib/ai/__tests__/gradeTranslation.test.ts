import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { gradeTranslation } from '../gradeTranslation';
import { GradeStatus } from '@/types';

// Use vi.hoisted to ensure mocks are initialized before vi.mock factory runs
const { mockGenerateContent, mockModels } = vi.hoisted(() => {
  const generate = vi.fn();
  const models = { generateContent: generate };
  return { mockGenerateContent: generate, mockModels: models };
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = mockModels;
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
    },
  };
});

describe('gradeTranslation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns success result from AI', async () => {
    const mockResponse = {
      status: GradeStatus.CORRECT,
      feedback: 'Good job!',
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(mockResponse),
    });

    const result = await gradeTranslation({
      latin: 'Salve',
      userTranslation: 'Hello',
      reference: 'Hello',
    });

    expect(result).toEqual(mockResponse);
    expect(mockGenerateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-2.5-flash',
    }));
  });

  it('handles timeout gracefully (returns fallback)', async () => {
    // First attempt: Timeout
    mockGenerateContent.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 6000));
      return { text: '{}' };
    });

    // Second attempt: Error
    mockGenerateContent.mockRejectedValueOnce(new Error("API Error"));

    const result = await gradeTranslation({
      latin: 'Salve',
      userTranslation: 'Hello',
      reference: 'Hello',
    });

    expect(result.status).toBe(GradeStatus.PARTIAL);
    expect(result.feedback).toContain("couldn't reach the AI");
  }, 10000);

  it('returns fallback if API key is missing', async () => {
    process.env.GEMINI_API_KEY = '';

    const result = await gradeTranslation({
      latin: 'Salve',
      userTranslation: 'Hello',
      reference: 'Hello',
    });

    expect(result.status).toBe(GradeStatus.PARTIAL);
    // The class constructor is not called if API key is missing
  });

  it('guards against empty input', async () => {
      const result = await gradeTranslation({
          latin: 'Salve',
          userTranslation: '',
          reference: 'Hello'
      });

      expect(result.status).toBe(GradeStatus.INCORRECT);
      expect(result.feedback).toContain("provide a translation");
  });
});
