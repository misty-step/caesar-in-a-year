import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// Mock Clerk auth to always return a user with getToken
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({
    userId: 'user-1',
    getToken: () => Promise.resolve('mock-token'),
  }),
}));

const getUserProgress = vi.fn();
const getContent = vi.fn();

const getMasteredAtLevel = vi.fn().mockResolvedValue(0);

vi.mock('@/lib/data/adapter', () => ({
  createDataAdapter: () => ({
    getUserProgress,
    getContent,
    getMasteredAtLevel,
  }),
}));

// Mock ConvexProvider to avoid client requirements
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    getUserProgress.mockReset();
    getContent.mockReset();
  });

  it('renders fallback progress when no data is stored', async () => {
    getUserProgress.mockResolvedValueOnce(null);
    getContent.mockResolvedValueOnce({
      review: [],
      reading: {
        id: 'r1',
        title: 'Sample Reading',
        latinText: [],
        glossary: {},
        gistQuestion: '',
        referenceGist: '',
      },
    });

    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page');
    const tree = await DashboardPage();
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Day 1 of 365');
    expect(html).toContain('Sample Reading');
  });
});
