/** @vitest-environment jsdom */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException,
}));

import GlobalError from '@/app/global-error';
import DashboardError from '@/app/(app)/dashboard/error';
import SessionError from '@/app/(app)/session/error';
import SettingsError from '@/app/(app)/settings/error';
import SubscribeError from '@/app/(app)/subscribe/error';
import SummaryError from '@/app/(app)/summary/error';

describe('error boundaries', () => {
  beforeEach(() => {
    captureException.mockReset();
  });

  it.each([
    ['dashboard', DashboardError],
    ['session', SessionError],
    ['settings', SettingsError],
    ['subscribe', SubscribeError],
    ['summary', SummaryError],
  ])('%s route captures exceptions on mount', async (_, Component) => {
    const error = new Error('route exploded');
    const reset = vi.fn();

    render(<Component error={error} reset={reset} />);

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledWith(error);
    });
  });

  it('global error captures exception and supports reset', async () => {
    const error = new Error('global exploded');
    const reset = vi.fn();

    render(<GlobalError error={error} reset={reset} />);

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledWith(error);
    });

    expect(screen.getByText('Application Error')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
