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
const getProgressMetrics = vi.fn();

vi.mock('@/lib/data/adapter', () => ({
  createDataAdapter: () => ({
    getUserProgress,
    getContent,
    getProgressMetrics,
  }),
}));

// Mock ConvexProvider to avoid client requirements
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => null, // TrialBanner returns null when loading
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    getUserProgress.mockReset();
    getContent.mockReset();
    getProgressMetrics.mockReset();
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
    getProgressMetrics.mockResolvedValueOnce({
      legion: { tirones: 0, milites: 0, veterani: 0, decuriones: 0 },
      iter: { sentencesEncountered: 0, totalSentences: 365, percentComplete: 0, contentDay: 1, daysActive: 1, scheduleDelta: 0 },
      activity: [],
      xp: { total: 0, level: 1, currentLevelXp: 0, toNextLevel: 100 },
      streak: 0,
    });

    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page');
    const tree = await DashboardPage();
    const html = renderToString(tree as React.ReactElement);

    // Page renders core dashboard structure
    expect(html).toContain('Caesar in a Year');
    expect(html).toContain('Sample Reading');
  });
});
