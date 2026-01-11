import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GradeStatus } from '@/lib/data/types';

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

  beforeEach(async () => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    vi.clearAllMocks();
    // Reset module cache to clear cached Gemini client between tests
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns success result from AI', async () => {
    const { gradeTranslation } = await import('../gradeTranslation');
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
      model: 'gemini-3-flash-preview',
    }));
  });

  it('handles timeout gracefully (returns fallback)', async () => {
    const { gradeTranslation } = await import('../gradeTranslation');

    // All attempts fail (3 total with retry)
    mockGenerateContent.mockImplementation(async () => {
      throw new Error("Timeout");
    });

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
    const { gradeTranslation } = await import('../gradeTranslation');

    const result = await gradeTranslation({
      latin: 'Salve',
      userTranslation: 'Hello',
      reference: 'Hello',
    });

    expect(result.status).toBe(GradeStatus.PARTIAL);
  });

  it('guards against empty input', async () => {
    const { gradeTranslation } = await import('../gradeTranslation');

    const result = await gradeTranslation({
      latin: 'Salve',
      userTranslation: '',
      reference: 'Hello'
    });

    expect(result.status).toBe(GradeStatus.INCORRECT);
    expect(result.feedback).toContain("provide a translation");
  });
});
