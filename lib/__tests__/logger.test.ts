import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException,
}));

import { logError } from '@/lib/logger';

describe('logError', () => {
  beforeEach(() => {
    captureException.mockReset();
  });

  it('captures Error instances in sentry with extra fields', () => {
    const error = new Error('boom');

    logError(error, { context: 'unit-test', route: '/dashboard' });

    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        extra: expect.objectContaining({
          context: 'unit-test',
          route: '/dashboard',
        }),
      }),
    );
  });
});
