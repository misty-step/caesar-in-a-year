import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

const mockCookieStore = { get: vi.fn() };

// Mock Clerk auth to always return a user with getToken
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({
    userId: 'user-1',
    getToken: () => Promise.resolve('mock-token'),
  }),
}));

vi.mock('next/headers', () => ({
  cookies: () => mockCookieStore,
}));

const getUserProgress = vi.fn();
const getContent = vi.fn();
const getProgressMetrics = vi.fn();
const getActiveSession = vi.fn();

vi.mock('@/lib/data/adapter', () => ({
  createDataAdapter: () => ({
    getUserProgress,
    getContent,
    getProgressMetrics,
    getActiveSession,
  }),
  ConvexAuthError: class ConvexAuthError extends Error {
    context: Record<string, unknown>;
    constructor(message: string, context: Record<string, unknown> = {}) {
      super(message);
      this.name = 'ConvexAuthError';
      this.context = context;
    }
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
  setContext: vi.fn(),
}));

// Mock ConvexProvider to avoid client requirements
vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => null, // TrialBanner returns null when loading
}));

// Mock next/navigation for TrialBanner's useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    mockCookieStore.get.mockReset();
    mockCookieStore.get.mockReturnValue(undefined);
    getUserProgress.mockReset();
    getContent.mockReset();
    getProgressMetrics.mockReset();
    getActiveSession.mockReset();
    getActiveSession.mockResolvedValue(null);
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
    expect(getProgressMetrics).toHaveBeenCalledWith('user-1', 0);
  });

  it('does not render FirstSessionGuidance for returning users', async () => {
    getUserProgress.mockResolvedValueOnce({
      userId: 'user-1',
      streak: 3,
      totalXp: 150,
      maxDifficulty: 1,
      lastSessionAt: Date.now() - 86400000,
    });
    getContent.mockResolvedValueOnce({
      review: [{ id: 's1', latin: 'Gallia est omnis divisa', english: 'All Gaul is divided', reference: 'BG 1.1', difficulty: 1, sentenceIndex: 0, passageId: 'p1' }],
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
      iter: { sentencesEncountered: 5, totalSentences: 365, percentComplete: 1, contentDay: 5, daysActive: 5, scheduleDelta: 0 },
      activity: [],
      xp: { total: 150, level: 2, currentLevelXp: 50, toNextLevel: 100 },
      streak: 3,
    });

    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page');
    const tree = await DashboardPage();
    const html = renderToString(tree as React.ReactElement);

    // FirstSessionGuidance should NOT appear for returning users
    expect(html).not.toContain('What to expect today');
    expect(html).not.toContain('Dismiss guidance');
  });

  it('uses tzOffsetMin cookie for progress metric timing', async () => {
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
    mockCookieStore.get.mockReturnValue({ value: '480' });

    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page');
    const tree = await DashboardPage();
    const html = renderToString(tree as React.ReactElement);

    expect(getProgressMetrics).toHaveBeenCalledWith('user-1', 480);
    expect(html).toContain('Sample Reading');
  });

  it.each([
    { description: 'defaults to 0 when cookie value is empty string', cookieValue: '', expectedOffset: 0 },
    { description: 'defaults to 0 when cookie value is NaN', cookieValue: 'not-a-number', expectedOffset: 0 },
    { description: 'clamps out-of-range positive cookie value to 720', cookieValue: '999', expectedOffset: 720 },
    { description: 'clamps out-of-range negative cookie value to -720', cookieValue: '-999', expectedOffset: -720 },
    { description: 'handles negative timezone offset (UTC+ zones)', cookieValue: '-330', expectedOffset: -330 },
  ])('$description', async ({ cookieValue, expectedOffset }) => {
    getUserProgress.mockResolvedValueOnce(null);
    getContent.mockResolvedValueOnce({
      review: [],
      reading: { id: 'r1', title: 'Sample Reading', latinText: [], glossary: {}, gistQuestion: '', referenceGist: '' },
    });
    getProgressMetrics.mockResolvedValueOnce({
      legion: { tirones: 0, milites: 0, veterani: 0, decuriones: 0 },
      iter: { sentencesEncountered: 0, totalSentences: 365, percentComplete: 0, contentDay: 1, daysActive: 1, scheduleDelta: 0 },
      activity: [],
      xp: { total: 0, level: 1, currentLevelXp: 0, toNextLevel: 100 },
      streak: 0,
    });
    mockCookieStore.get.mockReturnValue({ value: cookieValue });

    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page');
    const tree = await DashboardPage();
    renderToString(tree as React.ReactElement);

    expect(getProgressMetrics).toHaveBeenCalledWith('user-1', expectedOffset);
  });
});
