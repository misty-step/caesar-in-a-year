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
    gradePhrase.mockReset().mockResolvedValue({ status: 'CORRECT', feedback: 'Good.', correction: undefined });
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

  it('returns 429 when rate limit exceeded', async () => {
    const resetAtMs = Date.now() + 3600000;
    consumeAiCall.mockReturnValueOnce({ allowed: false, remaining: 0, resetAtMs });

    const req = new Request('http://localhost/api/phrase-review', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', itemIndex: 0, phraseCardId: 'card-1', userInput: 'All Gaul' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toBe('Rate limit exceeded');
    expect(json.resetAtMs).toBe(resetAtMs);
    expect(fetchQuery).not.toHaveBeenCalled();
    expect(gradePhrase).not.toHaveBeenCalled();
  });

  it('calls consumeAiCall and proceeds when within quota', async () => {
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
  });
});
