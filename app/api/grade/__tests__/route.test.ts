import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/grade/route';

// Mock Clerk auth to provide a userId with getToken
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({
    userId: 'user-1',
    getToken: () => Promise.resolve('mock-token'),
  }),
}));

// Use vi.hoisted to declare mock before hoisting
const { submitReviewForUser } = vi.hoisted(() => ({
  submitReviewForUser: vi.fn(),
}));

vi.mock('@/app/(app)/session/[sessionId]/actions', () => ({
  submitReviewForUser,
}));

// Mock rate limiter to always allow
vi.mock('@/lib/rateLimit/inMemoryRateLimit', () => ({
  consumeAiCall: () => ({ allowed: true, remaining: 99, resetAtMs: Date.now() + 3600000 }),
}));

describe('POST /api/grade', () => {
  beforeEach(() => {
    submitReviewForUser.mockReset();
  });

  it('returns 400 for invalid payload', async () => {
    const req = new Request('http://localhost/api/grade', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid payload');
    expect(submitReviewForUser).not.toHaveBeenCalled();
  });

  it('invokes submitReviewForUser and returns result with rate limit info', async () => {
    submitReviewForUser.mockResolvedValueOnce({
      result: { status: 'CORRECT', feedback: 'Nice.', correction: undefined },
      nextIndex: 1,
      status: 'active',
    });

    const req = new Request('http://localhost/api/grade', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'sess-1',
        itemIndex: 0,
        userInput: 'hello',
        tzOffsetMin: 300,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(submitReviewForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'sess-1',
      itemIndex: 0,
      userInput: 'hello',
      token: 'mock-token',
      tzOffsetMin: 300,
      aiAllowed: true,
    });

    expect(json.result).toEqual({ status: 'CORRECT', feedback: 'Nice.', correction: undefined });
    expect(json.nextIndex).toBe(1);
    expect(json.status).toBe('active');
    expect(json.rateLimit).toBeDefined();
    expect(json.rateLimit.remaining).toBe(99);
  });
});
