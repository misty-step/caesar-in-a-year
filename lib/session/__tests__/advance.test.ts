import { describe, it, expect } from 'vitest';
import { advanceSession } from '../advance';
import type { Session } from '@/lib/data/types';

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session',
    userId: 'test-user',
    items: [
      { type: 'REVIEW', sentence: { id: 's1', latin: 'Gallia est omnis divisa', referenceTranslation: 'All Gaul is divided' } },
      { type: 'REVIEW', sentence: { id: 's2', latin: 'in partes tres', referenceTranslation: 'into three parts' } },
    ],
    currentIndex: 0,
    status: 'active',
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('advanceSession', () => {
  it('advances index when mid-session', () => {
    const session = createSession({ currentIndex: 0 });
    const result = advanceSession(session);
    expect(result.nextIndex).toBe(1);
    expect(result.status).toBe('active');
  });

  it('completes and clamps when reaching end', () => {
    const session = createSession({ currentIndex: 1 });
    const result = advanceSession(session);
    expect(result.nextIndex).toBe(2); // items.length
    expect(result.status).toBe('complete');
  });

  it('is idempotent when already complete', () => {
    const session = createSession({ currentIndex: 2, status: 'complete' });
    const result = advanceSession(session);
    expect(result.nextIndex).toBe(2);
    expect(result.status).toBe('complete');
  });

  it('clamps when currentIndex is beyond end', () => {
    const session = createSession({ currentIndex: 5, status: 'active' });
    const result = advanceSession(session);
    expect(result.nextIndex).toBe(2); // items.length
    expect(result.status).toBe('complete');
  });

  it('handles empty session', () => {
    const session = createSession({ items: [], currentIndex: 0 });
    const result = advanceSession(session);
    expect(result.nextIndex).toBe(0);
    expect(result.status).toBe('complete');
  });
});
