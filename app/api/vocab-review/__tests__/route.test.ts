import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/vocab-review/route';

vi.mock('server-only', () => ({}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({
    userId: 'user-1',
    getToken: () => Promise.resolve('mock-token'),
  }),
}));

vi.mock('@/convex/_generated/api', () => ({
  api: {
    sessions: { get: 'sessions:get', advance: 'sessions:advance' },
    vocab: { get: 'vocab:get', recordReview: 'vocab:recordReview' },
  },
}));

const fetchQuery = vi.fn();
const fetchMutation = vi.fn();
vi.mock('convex/nextjs', () => ({
  fetchQuery: (...args: unknown[]) => fetchQuery(...args),
  fetchMutation: (...args: unknown[]) => fetchMutation(...args),
}));

vi.mock('@/lib/ai/grading-utils', () => ({
  AI_UNAVAILABLE_FEEDBACK:
    "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.",
}));

const gradeVocab = vi.fn();
vi.mock('@/lib/ai/gradeVocab', () => ({
  gradeVocab: (...args: unknown[]) => gradeVocab(...args),
}));

vi.mock('@/lib/session/advance', () => ({
  advanceSession: () => ({ nextIndex: 1, status: 'active' }),
}));

vi.mock('@/lib/session/id', () => ({
  normalizeSessionId: (id: string) => id,
}));

const consumeAiCall = vi.fn();
vi.mock('@/lib/rateLimit/inMemoryRateLimit', () => ({
  consumeAiCall: (...args: unknown[]) => consumeAiCall(...args),
}));

const mockSession = {
  sessionId: 'sess-1',
  userId: 'user-1',
  currentIndex: 0,
  status: 'active',
  startedAt: Date.now(),
  items: [
    {
      type: 'VOCAB_DRILL',
      vocab: { latinWord: 'bellum', meaning: 'war', question: 'Translate bellum' },
    },
  ],
};

const mockVocabCard = {
  state: 'new',
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  nextReviewAt: Date.now() + 86400000,
};

describe('POST /api/vocab-review', () => {
  beforeEach(() => {
    consumeAiCall.mockReset().mockReturnValue({ allowed: true, remaining: 99, resetAtMs: Date.now() + 3600000 });
    fetchQuery.mockReset();
    fetchMutation.mockReset().mockResolvedValue(undefined);
    gradeVocab.mockReset().mockResolvedValue({ status: 'CORRECT', feedback: 'Good.', correction: undefined });
  });

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: 'not json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid payload');
    expect(consumeAiCall).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload', async () => {
    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid payload');
    expect(consumeAiCall).not.toHaveBeenCalled();
  });

  it('returns 400 for oversized input before rate limiting', async () => {
    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'sess-1',
        itemIndex: 0,
        vocabCardId: 'card-1',
        userInput: 'a'.repeat(501),
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Input too long');
    expect(consumeAiCall).not.toHaveBeenCalled();
  });

  it('returns PARTIAL fallback when rate limited (ADR 0003)', async () => {
    const resetAtMs = Date.now() + 3600000;
    consumeAiCall.mockReturnValueOnce({ allowed: false, remaining: 0, resetAtMs });

    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(mockVocabCard);

    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, vocabCardId: 'card-1', userInput: 'war' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // Graceful fallback: PARTIAL grading, no AI call
    expect(gradeVocab).not.toHaveBeenCalled();
    expect(json.grading.status).toBe('PARTIAL');
    expect(json.grading.feedback).toContain("couldn't reach the AI tutor");
    expect(json.grading.hint).toBe('war');

    // Session still advances
    expect(json.nextIndex).toBe(1);
    expect(json.status).toBe('active');

    // Rate limit info surfaced
    expect(json.rateLimit).toEqual({ remaining: 0, resetAtMs });
  });

  it('records FSRS review as PARTIAL when rate limited', async () => {
    consumeAiCall.mockReturnValueOnce({ allowed: false, remaining: 0, resetAtMs: Date.now() + 3600000 });

    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(mockVocabCard);

    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, vocabCardId: 'card-1', userInput: 'war' }),
    });

    await POST(req);

    // FSRS mutation called with PARTIAL status (maps to Rating.Hard per ADR 0002)
    expect(fetchMutation).toHaveBeenCalledWith(
      'vocab:recordReview',
      expect.objectContaining({
        userId: 'user-1',
        cardId: 'card-1',
        gradingStatus: 'PARTIAL',
      }),
      expect.anything()
    );
  });

  it('does not consume rate limit token when session not found', async () => {
    fetchQuery.mockResolvedValueOnce({ session: null, error: 'not found' });

    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'bad-sess', itemIndex: 0, vocabCardId: 'card-1', userInput: 'war' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(consumeAiCall).not.toHaveBeenCalled();
  });

  it('returns 404 when vocab card not found', async () => {
    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, vocabCardId: 'missing', userInput: 'war' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Vocab card not found');
    expect(consumeAiCall).not.toHaveBeenCalled();
  });

  it('handles AI-layer fallback when rate limit allows but grader returns PARTIAL', async () => {
    gradeVocab.mockResolvedValueOnce({ status: 'PARTIAL', feedback: "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.", hint: undefined });

    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(mockVocabCard);

    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, vocabCardId: 'card-1', userInput: 'war' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // AI was called but returned PARTIAL (e.g. circuit breaker)
    expect(gradeVocab).toHaveBeenCalled();
    expect(json.grading.status).toBe('PARTIAL');

    // FSRS still records the PARTIAL status
    expect(fetchMutation).toHaveBeenCalledWith(
      'vocab:recordReview',
      expect.objectContaining({ gradingStatus: 'PARTIAL' }),
      expect.anything()
    );
  });

  it('calls AI grader and includes rateLimit when within quota', async () => {
    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(mockVocabCard);

    const req = new Request('http://localhost/api/vocab-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, vocabCardId: 'card-1', userInput: 'war' }),
    });

    const res = await POST(req);
    expect(consumeAiCall).toHaveBeenCalledWith('user-1', expect.any(Number));
    expect(gradeVocab).toHaveBeenCalled();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.rateLimit).toBeDefined();
    expect(json.rateLimit.remaining).toBe(99);
  });
});
