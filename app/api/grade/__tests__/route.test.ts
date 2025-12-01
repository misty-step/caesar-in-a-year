import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/grade/route';

// Mock Clerk auth to provide a userId
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: 'user-1' }),
}));

// Mock the shared submitReviewForUser flow
const submitReviewForUser = vi.fn();
vi.mock('@/app/(app)/session/[sessionId]/actions', () => ({
  submitReviewForUser,
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

  it('invokes submitReviewForUser and returns result', async () => {
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
    });

    expect(json).toEqual({
      result: { status: 'CORRECT', feedback: 'Nice.', correction: undefined },
      nextIndex: 1,
      status: 'active',
    });
  });
});
