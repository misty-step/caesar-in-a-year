import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: 'user-1' }),
}));

const getSession = vi.fn();

vi.mock('@/lib/data/adapter', () => ({
  createDataAdapter: () => ({
    getSession,
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
    const tree = await SummaryPage({ params: { sessionId: 'sess-1' } });
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Session Summary');
  });
});

