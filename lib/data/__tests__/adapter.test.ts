import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataAdapter, ConvexAuthError } from '@/lib/data/adapter';
import { ConvexAdapter } from '@/lib/data/convexAdapter';
import { GradeStatus } from '@/lib/data/types';
import type { Attempt } from '@/lib/data/types';

describe('createDataAdapter', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('production mode without token throws ConvexAuthError with correct context', () => {
    vi.stubEnv('NODE_ENV', 'production');

    let error: unknown;

    try {
      createDataAdapter();
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ConvexAuthError);

    const authError = error as ConvexAuthError;
    expect(authError.context).toEqual({
      hasToken: false,
      environment: 'production',
      hint: 'Verify Clerk JWT template "convex" exists and matches CLERK_JWT_ISSUER_DOMAIN in Convex env vars',
    });
  });

  it('production mode without token logs structured error before throwing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const consoleSpy = vi.spyOn(console, 'error');

    try {
      createDataAdapter();
    } catch {
      // Expected to throw
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      '[DataAdapter] Auth error:',
      expect.objectContaining({
        error: expect.stringContaining('Convex authentication token is missing'),
        hasToken: false,
        environment: 'production',
        hint: expect.any(String),
      })
    );
  });

  it('production mode with token returns ConvexAdapter', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const adapter = createDataAdapter('token');
    expect(adapter).toBeInstanceOf(ConvexAdapter);
  });

  it('dev mode without token returns fallback adapter', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const adapter = createDataAdapter();
    expect(adapter).not.toBeInstanceOf(ConvexAdapter);
  });

  it('dev mode with token still returns ConvexAdapter', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const adapter = createDataAdapter('token');
    expect(adapter).toBeInstanceOf(ConvexAdapter);
  });
});

describe('memoryAdapter.getSessionAttemptSummary', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function makeAttempt(sessionId: string, status: GradeStatus): Attempt {
    return {
      userId: 'user-1',
      sessionId,
      itemId: `sentence-${Math.random()}`,
      type: 'REVIEW',
      userInput: 'test',
      gradingResult: { status, feedback: 'ok' },
      createdAt: new Date().toISOString(),
    };
  }

  it('returns zeroes for session with no attempts', async () => {
    const adapter = createDataAdapter();
    const summary = await adapter.getSessionAttemptSummary('no-such-session', 'user-1');
    expect(summary).toEqual({ correct: 0, partial: 0, incorrect: 0, total: 0 });
  });

  it('counts CORRECT, PARTIAL, and INCORRECT attempts', async () => {
    const adapter = createDataAdapter();
    const sessionId = 'test-session-summary';

    // Create a session first so the adapter tracks the user
    const session = await adapter.createSession('user-1', [
      { type: 'REVIEW', sentence: { id: 's1', latin: 'test', referenceTranslation: 'test' } },
    ]);

    // Record attempts with varying statuses
    await adapter.recordAttempt(makeAttempt(session.id, GradeStatus.CORRECT));
    await adapter.recordAttempt(makeAttempt(session.id, GradeStatus.CORRECT));
    await adapter.recordAttempt(makeAttempt(session.id, GradeStatus.PARTIAL));
    await adapter.recordAttempt(makeAttempt(session.id, GradeStatus.INCORRECT));

    const summary = await adapter.getSessionAttemptSummary(session.id, 'user-1');
    expect(summary).toEqual({ correct: 2, partial: 1, incorrect: 1, total: 4 });
  });
});
