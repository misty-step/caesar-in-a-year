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

vi.mock('@/lib/data/adapter', () => ({
  createDataAdapter: () => ({
    getSession,
    getUserProgress,
    getMasteredAtLevel,
  }),
}));

describe('SummaryPage', () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it('renders session summary with item count', async () => {
    getSession.mockResolvedValueOnce({
      id: 'sess-1',
      userId: 'user-1',
      items: [],
      currentIndex: 0,
      status: 'complete',
      startedAt: new Date().toISOString(),
    });

    const { default: SummaryPage } = await import('@/app/(app)/summary/[sessionId]/page');
    const tree = await SummaryPage({
      params: Promise.resolve({ sessionId: 'sess-1' }),
      searchParams: Promise.resolve({})
    });
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Session Summary');
  });
});

