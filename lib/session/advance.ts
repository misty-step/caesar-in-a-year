import type { Session, SessionStatus } from '@/lib/data/types';

export type AdvanceResult = {
  nextIndex: number;
  status: SessionStatus;
};

/**
 * Advance session pointer by one item. Idempotent when already complete or past end.
 */
export function advanceSession(session: Session): AdvanceResult {
  if (session.status === 'complete') {
    return { nextIndex: session.currentIndex, status: 'complete' };
  }

  const nextIndex = session.currentIndex + 1;
  return {
    nextIndex,
    status: nextIndex >= session.items.length ? 'complete' : 'active',
  };
}
