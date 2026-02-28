/* @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SummaryCard } from '../SummaryCard';
import type { AttemptSummary, Session } from '@/lib/data/types';

// Mock LatinText to render english text for easy assertions
vi.mock('@/components/UI/LatinText', () => ({
  LatinText: ({ english }: { latin: string; english: string }) => <span>{english}</span>,
}));

afterEach(cleanup);

function buildSession(overrides?: Partial<Session>): Session {
  return {
    id: 'session-1',
    userId: 'user-1',
    items: [
      { type: 'REVIEW', sentence: { id: 's1', latin: 'Gallia est omnis divisa', referenceTranslation: 'All Gaul is divided' } },
      { type: 'REVIEW', sentence: { id: 's2', latin: 'in partes tres', referenceTranslation: 'into three parts' } },
      { type: 'REVIEW', sentence: { id: 's3', latin: 'quarum unam', referenceTranslation: 'one of which' } },
    ],
    currentIndex: 3,
    status: 'complete',
    startedAt: '2026-02-28T10:00:00Z',
    completedAt: '2026-02-28T10:15:00Z',
    ...overrides,
  };
}

const defaultSummary: AttemptSummary = {
  correct: 5,
  partial: 2,
  incorrect: 1,
  total: 8,
};

describe('SummaryCard', () => {
  it('renders accuracy breakdown with correct/partial/incorrect counts', () => {
    render(
      <SummaryCard session={buildSession()} attemptSummary={defaultSummary} streak={0} />
    );

    const accuracyGroup = screen.getByRole('group', { name: 'Accuracy breakdown' });
    expect(accuracyGroup.textContent).toContain('5');
    expect(accuracyGroup.textContent).toContain('Correct');
    expect(accuracyGroup.textContent).toContain('2');
    expect(accuracyGroup.textContent).toContain('Partial');
    expect(accuracyGroup.textContent).toContain('1');
    expect(accuracyGroup.textContent).toContain('Incorrect');
  });

  it('hides accuracy breakdown when no attempts recorded', () => {
    const empty: AttemptSummary = { correct: 0, partial: 0, incorrect: 0, total: 0 };
    render(
      <SummaryCard session={buildSession()} attemptSummary={empty} streak={0} />
    );

    expect(screen.queryByText('Correct')).toBeNull();
    expect(screen.queryByText('Partial')).toBeNull();
    expect(screen.queryByText('Incorrect')).toBeNull();
  });

  it('shows streak when streak > 0', () => {
    render(
      <SummaryCard session={buildSession()} attemptSummary={defaultSummary} streak={12} />
    );

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Day streak')).toBeTruthy();
  });

  it('hides streak when streak is 0', () => {
    render(
      <SummaryCard session={buildSession()} attemptSummary={defaultSummary} streak={0} />
    );

    expect(screen.queryByText('Day streak')).toBeNull();
  });

  it('shows XP based on session item count', () => {
    const session = buildSession(); // 3 items × 10 XP = +30
    render(
      <SummaryCard session={session} attemptSummary={defaultSummary} streak={0} />
    );

    expect(screen.getByText('+30')).toBeTruthy();
    expect(screen.getByText('XP')).toBeTruthy();
  });

  it('shows total segment count', () => {
    render(
      <SummaryCard session={buildSession()} attemptSummary={defaultSummary} streak={0} />
    );

    const statsGroup = screen.getByRole('group', { name: 'Session statistics' });
    expect(statsGroup.textContent).toContain('3');
    expect(statsGroup.textContent).toContain('Segments');
  });
});
