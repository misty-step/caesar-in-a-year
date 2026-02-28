import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/phrase-review/route';

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
    phrases: { get: 'phrases:get', recordReview: 'phrases:recordReview' },
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

const gradePhrase = vi.fn();
vi.mock('@/lib/ai/gradePhrase', () => ({
  gradePhrase: (...args: unknown[]) => gradePhrase(...args),
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
      type: 'PHRASE_DRILL',
      phrase: { latin: 'Gallia est omnis divisa', english: 'All Gaul is divided', context: 'Opening' },
    },
  ],
};

const mockPhraseCard = {
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

describe('POST /api/phrase-review', () => {
  beforeEach(() => {
    consumeAiCall.mockReset().mockReturnValue({ allowed: true, remaining: 99, resetAtMs: Date.now() + 3600000 });
    fetchQuery.mockReset();
    fetchMutation.mockReset().mockResolvedValue(undefined);
    gradePhrase.mockReset().mockResolvedValue({ status: 'CORRECT', feedback: 'Good.' });
  });

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/phrase-review', {
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
    const req = new Request('http://localhost/api/phrase-review', {
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
    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'sess-1',
        itemIndex: 0,
        phraseCardId: 'card-1',
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
      .mockResolvedValueOnce(mockPhraseCard);

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, phraseCardId: 'card-1', userInput: 'All Gaul' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // Graceful fallback: PARTIAL grading, no AI call
    expect(gradePhrase).not.toHaveBeenCalled();
    expect(json.grading.status).toBe('PARTIAL');
    expect(json.grading.feedback).toContain("couldn't reach the AI tutor");
    expect(json.grading.hint).toBe('All Gaul is divided');

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
      .mockResolvedValueOnce(mockPhraseCard);

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, phraseCardId: 'card-1', userInput: 'All Gaul' }),
    });

    await POST(req);

    // FSRS mutation called with PARTIAL status (maps to Rating.Hard per ADR 0002)
    expect(fetchMutation).toHaveBeenCalledWith(
      'phrases:recordReview',
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

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'bad-sess', itemIndex: 0, phraseCardId: 'card-1', userInput: 'All Gaul' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(consumeAiCall).not.toHaveBeenCalled();
  });

  it('returns 404 when phrase card not found', async () => {
    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, phraseCardId: 'missing', userInput: 'All Gaul' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Phrase card not found');
    expect(consumeAiCall).not.toHaveBeenCalled();
  });

  it('handles AI-layer fallback when rate limit allows but grader returns PARTIAL', async () => {
    gradePhrase.mockResolvedValueOnce({ status: 'PARTIAL', feedback: "We couldn't reach the AI tutor right now. Please compare your answer with the reference manually.", hint: undefined });

    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(mockPhraseCard);

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, phraseCardId: 'card-1', userInput: 'All Gaul' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // AI was called but returned PARTIAL (e.g. circuit breaker)
    expect(gradePhrase).toHaveBeenCalled();
    expect(json.grading.status).toBe('PARTIAL');

    // FSRS still records the PARTIAL status
    expect(fetchMutation).toHaveBeenCalledWith(
      'phrases:recordReview',
      expect.objectContaining({ gradingStatus: 'PARTIAL' }),
      expect.anything()
    );
  });

  it('returns 500 when grader throws an unexpected error', async () => {
    gradePhrase.mockRejectedValueOnce(new Error('unexpected SDK failure'));

    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(mockPhraseCard);

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, phraseCardId: 'card-1', userInput: 'All Gaul' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal Server Error');
  });

  it('calls AI grader and includes rateLimit when within quota', async () => {
    fetchQuery
      .mockResolvedValueOnce({ session: mockSession })
      .mockResolvedValueOnce(mockPhraseCard);

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, phraseCardId: 'card-1', userInput: 'All Gaul' }),
    });

    const res = await POST(req);
    expect(consumeAiCall).toHaveBeenCalledWith('user-1', expect.any(Number));
    expect(gradePhrase).toHaveBeenCalled();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.rateLimit).toBeDefined();
    expect(json.rateLimit.remaining).toBe(99);
  });
});
