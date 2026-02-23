import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDataAdapter, ConvexAuthError } from '@/lib/data/adapter';
import { ConvexAdapter } from '@/lib/data/convexAdapter';

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
