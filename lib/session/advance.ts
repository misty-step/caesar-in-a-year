import type { Session, SessionStatus } from '@/lib/data/types';

export type AdvanceResult = {
  nextIndex: number;
  status: SessionStatus;
};

/**
 * Advance session pointer by one item. Idempotent when already complete or past end.
 * Clamps nextIndex to items.length when complete to prevent runaway increment.
 */
export function advanceSession(session: Session): AdvanceResult {
  // Already complete → no change
  if (session.status === 'complete') {
    return { nextIndex: session.currentIndex, status: 'complete' };
  }

  // Empty session edge case
  if (session.items.length === 0) {
    return { nextIndex: 0, status: 'complete' };
  }

  // Current index somehow beyond end → clamp and complete
  if (session.currentIndex >= session.items.length) {
    return { nextIndex: session.items.length, status: 'complete' };
  }

  const nextIndex = session.currentIndex + 1;
  const isComplete = nextIndex >= session.items.length;

  return {
    nextIndex: isComplete ? session.items.length : nextIndex,
    status: isComplete ? 'complete' : 'active',
  };
}
