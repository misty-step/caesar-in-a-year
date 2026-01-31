/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReviewStep } from '@/components/Session/ReviewStep';
import { GradeStatus, type RateLimitInfo, type Sentence } from '@/lib/data/types';

vi.mock('@/components/UI/AudioButton', () => ({
  AudioButton: () => <button type="button">Audio</button>,
}));

const sentence: Sentence = {
  id: 's1',
  latin: 'Gallia est omnis divisa in partes tres.',
  referenceTranslation: 'Gaul is divided into three parts.',
};

const userInput = 'My translation.';

const buildResponse = (rateLimit?: RateLimitInfo) => ({
  ok: true,
  json: async () => ({
    result: { status: GradeStatus.CORRECT, feedback: 'Nice.' },
    userInput,
    nextIndex: 1,
    status: 'active',
    ...(rateLimit ? { rateLimit } : {}),
  }),
});

const submitReview = async () => {
  const onAdvance = vi.fn();
  const { container } = render(
    <ReviewStep
      sentence={sentence}
      sessionId="sess-1"
      itemIndex={0}
      onAdvance={onAdvance}
    />
  );

  fireEvent.change(screen.getByPlaceholderText('Write your translation...'), {
    target: { value: userInput },
  });

  // Find submit button by role (handles the bilingual button structure)
  const submitButton = container.querySelector('button:not([type="button"])') as HTMLButtonElement;
  fireEvent.click(submitButton);

  await screen.findByText('Optime!');
};

describe('ReviewStep rate limit banner', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock as typeof fetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders banner when rateLimit.remaining === 0', async () => {
    const rateLimit = { remaining: 0, resetAtMs: Date.now() + 60_000 };
    fetchMock.mockResolvedValueOnce(buildResponse(rateLimit));

    await submitReview();

    expect(screen.getByText('Magister quiescit.')).toBeTruthy();
  });

  it('hides banner when rateLimit.remaining > 0', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse({ remaining: 2, resetAtMs: Date.now() + 60_000 }));

    await submitReview();

    expect(screen.queryByText('Magister quiescit.')).toBeNull();
  });

  it('hides banner when rateLimit is undefined', async () => {
    fetchMock.mockResolvedValueOnce(buildResponse());

    await submitReview();

    expect(screen.queryByText('Magister quiescit.')).toBeNull();
  });

  it('shows reset time from rateLimit.resetAtMs', async () => {
    const resetAtMs = Date.UTC(2025, 0, 1, 18, 45, 0);
    fetchMock.mockResolvedValueOnce(buildResponse({ remaining: 0, resetAtMs }));

    await submitReview();

    const expectedTime = new Date(resetAtMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const resetLine = screen.getByText(/Iterum tenta hora/);
    expect(resetLine.textContent).toContain(expectedTime);
  });
});
