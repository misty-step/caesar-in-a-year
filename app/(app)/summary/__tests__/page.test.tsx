import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({
    userId: 'user-1',
    getToken: () => Promise.resolve('mock-token'),
  }),
}));

const getSession = vi.fn();
const getUserProgress = vi.fn().mockResolvedValue(null);
const getMasteredAtLevel = vi.fn().mockResolvedValue(0);
const getSessionAttemptSummary = vi.fn().mockResolvedValue({ correct: 0, partial: 0, incorrect: 0, total: 0 });

vi.mock('@/lib/data/adapter', () => ({
  createDataAdapter: () => ({
    getSession,
    getUserProgress,
    getMasteredAtLevel,
    getSessionAttemptSummary,
  }),
}));

const completeSession = {
  id: 'sess-1',
  userId: 'user-1',
  items: [],
  currentIndex: 0,
  status: 'complete',
  startedAt: new Date().toISOString(),
};

describe('SummaryPage', () => {
  beforeEach(() => {
    getSession.mockReset();
    getUserProgress.mockReset().mockResolvedValue(null);
    getSessionAttemptSummary.mockReset().mockResolvedValue({ correct: 0, partial: 0, incorrect: 0, total: 0 });
  });

  it('renders session summary with item count', async () => {
    getSession.mockResolvedValueOnce(completeSession);

    const { default: SummaryPage } = await import('@/app/(app)/summary/[sessionId]/page');
    const tree = await SummaryPage({
      params: Promise.resolve({ sessionId: 'sess-1' }),
      searchParams: Promise.resolve({})
    });
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Session Summary');
  });

  it('renders with streak=0 when getUserProgress returns null', async () => {
    getSession.mockResolvedValueOnce(completeSession);
    getUserProgress.mockResolvedValueOnce(null);

    const { default: SummaryPage } = await import('@/app/(app)/summary/[sessionId]/page');
    const tree = await SummaryPage({
      params: Promise.resolve({ sessionId: 'sess-1' }),
      searchParams: Promise.resolve({})
    });
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Session Summary');
    expect(html).not.toContain('Day streak');
  });

  it('renders gracefully when getSessionAttemptSummary fails', async () => {
    getSession.mockResolvedValueOnce(completeSession);
    getSessionAttemptSummary.mockRejectedValueOnce(new Error('Network error'));

    const { default: SummaryPage } = await import('@/app/(app)/summary/[sessionId]/page');
    const tree = await SummaryPage({
      params: Promise.resolve({ sessionId: 'sess-1' }),
      searchParams: Promise.resolve({})
    });
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Session Summary');
    expect(html).not.toContain('Correct');
  });
});

