import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GradeStatus } from '@/lib/data/types';

vi.mock('server-only', () => ({}));

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
  };
});

describe('callWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('retries with exponential backoff', async () => {
    const { callWithRetry } = await import('../grading-utils');
    const timeoutSpy = vi.spyOn(global, 'setTimeout');
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce('ok');

    const promise = callWithRetry(fn, { maxAttempts: 3, backoffMs: 100, timeoutMs: 10000 });
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    const delays = timeoutSpy.mock.calls.map(([, ms]) => ms);
    const backoffs = delays.filter((ms) => ms === 100 || ms === 200);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(backoffs).toEqual([100, 200]);
    timeoutSpy.mockRestore();
  });

  it('times out correctly', async () => {
    const { callWithRetry } = await import('../grading-utils');
    const fn = vi.fn(() => new Promise(() => {}));

    const promise = callWithRetry(fn, { maxAttempts: 1, timeoutMs: 500 });
    const expectation = expect(promise).rejects.toThrow('Timeout');
    await vi.advanceTimersByTimeAsync(500);
    await expectation;
  });

  it('returns on first success', async () => {
    const { callWithRetry } = await import('../grading-utils');
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await callWithRetry(fn, { maxAttempts: 3 });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max attempts exhausted', async () => {
    const { callWithRetry } = await import('../grading-utils');
    const fn = vi.fn().mockRejectedValue(new Error('nope'));

    const promise = callWithRetry(fn, { maxAttempts: 2, backoffMs: 50, timeoutMs: 10000 });
    const expectation = expect(promise).rejects.toThrow('nope');
    await vi.advanceTimersByTimeAsync(50);
    await expectation;
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('getGeminiClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when GEMINI_API_KEY missing', async () => {
    process.env = { ...originalEnv, GEMINI_API_KEY: '' };
    const { getGeminiClient } = await import('../grading-utils');

    expect(getGeminiClient()).toBeNull();
  });

  it('caches and returns same instance', async () => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    const { getGeminiClient } = await import('../grading-utils');

    const first = getGeminiClient();
    const second = getGeminiClient();

    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });
});

describe('gradeWithAI', () => {
  const originalEnv = process.env;
  const fallback = {
    status: GradeStatus.PARTIAL,
    feedback: 'fallback',
    correction: 'corr',
  };

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key' };
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const baseOptions = {
    prompt: 'Prompt',
    schema: { type: 'object' } as never,
    fallbackMessage: fallback.feedback,
    fallbackCorrection: fallback.correction,
  };

  it('returns fallback when circuit open', async () => {
    const gradingUtils = await import('../grading-utils');
    for (let i = 0; i < 5; i += 1) gradingUtils.recordFailure();

    const result = await gradingUtils.gradeWithAI(baseOptions);

    expect(result).toEqual(fallback);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns fallback when no API key', async () => {
    process.env = { ...originalEnv, GEMINI_API_KEY: '' };
    const { gradeWithAI } = await import('../grading-utils');

    const result = await gradeWithAI(baseOptions);

    expect(result).toEqual(fallback);
  });

  it('handles JSON parse errors gracefully', async () => {
    const gradingUtils = await import('../grading-utils');
    for (let i = 0; i < 4; i += 1) gradingUtils.recordFailure();

    mockGenerateContent.mockResolvedValueOnce({ text: 'not-json' });

    const result = await gradingUtils.gradeWithAI(baseOptions);

    expect(result).toEqual(fallback);
    expect(gradingUtils.isCircuitOpen()).toBe(true);
  });

  it('records success on successful response', async () => {
    const gradingUtils = await import('../grading-utils');
    for (let i = 0; i < 4; i += 1) gradingUtils.recordFailure();

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ status: GradeStatus.CORRECT, feedback: 'ok' }),
    });

    const result = await gradingUtils.gradeWithAI(baseOptions);
    gradingUtils.recordFailure();

    expect(result.status).toBe(GradeStatus.CORRECT);
    expect(gradingUtils.isCircuitOpen()).toBe(false);
  });

  it('records failure on error', async () => {
    const gradingUtils = await import('../grading-utils');
    for (let i = 0; i < 4; i += 1) gradingUtils.recordFailure();

    mockGenerateContent.mockRejectedValueOnce(new Error('boom'));

    const result = await gradingUtils.gradeWithAI(baseOptions);

    expect(result).toEqual(fallback);
    expect(gradingUtils.isCircuitOpen()).toBe(true);
  });
});
