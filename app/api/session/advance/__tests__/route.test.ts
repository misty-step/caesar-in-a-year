import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/session/advance/route';

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: 'user-1' }),
}));

const advanceSessionForUser = vi.fn();
vi.mock('@/app/(app)/session/[sessionId]/actions', () => ({
  advanceSessionForUser,
}));

describe('POST /api/session/advance', () => {
  beforeEach(() => {
    advanceSessionForUser.mockReset();
  });

  it('returns 400 for invalid payload', async () => {
    const req = new Request('http://localhost/api/session/advance', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid payload');
    expect(advanceSessionForUser).not.toHaveBeenCalled();
  });

  it('advances session and returns result', async () => {
    advanceSessionForUser.mockResolvedValueOnce({
      nextIndex: 2,
      status: 'active',
    });

    const req = new Request('http://localhost/api/session/advance', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(advanceSessionForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'sess-1',
    });

    expect(json).toEqual({
      nextIndex: 2,
      status: 'active',
    });
  });
});
