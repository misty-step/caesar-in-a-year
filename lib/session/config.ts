/**
 * Session composition configuration based on learner progress.
 *
 * Target: Complete 2,211 sentences in 365 days (~6 sentences/day average).
 * Strategy: Vocab-heavy early (foundation), longer passages later (fluency).
 *
 * Sentence budget:
 * - Days 1-60:    4/day × 60 = 240 sentences
 * - Days 61-180:  6/day × 120 = 720 sentences
 * - Days 181-300: 7/day × 120 = 840 sentences
 * - Days 301-365: 8/day × 65 = 520 sentences
 * - Total: 2,320 (buffer for reviews/catch-up)
 */

export interface SessionConfig {
  vocabCount: number;
  phraseCount: number;
  reviewCount: number;
  newSentenceCount: number;
}

type Phase = 'beginner' | 'early-mid' | 'mid-late' | 'advanced';

const PHASE_CONFIG: Record<Phase, SessionConfig> = {
  beginner: { vocabCount: 4, phraseCount: 2, reviewCount: 2, newSentenceCount: 2 },
  'early-mid': { vocabCount: 2, phraseCount: 2, reviewCount: 3, newSentenceCount: 4 },
  'mid-late': { vocabCount: 1, phraseCount: 1, reviewCount: 3, newSentenceCount: 6 },
  advanced: { vocabCount: 0, phraseCount: 1, reviewCount: 3, newSentenceCount: 8 },
};

function getPhase(daysActive: number): Phase {
  if (daysActive <= 60) return 'beginner';
  if (daysActive <= 180) return 'early-mid';
  if (daysActive <= 300) return 'mid-late';
  return 'advanced';
}

/**
 * Get session configuration based on learner's days active.
 * Returns counts for each item type in the session.
 */
export function getSessionConfig(daysActive: number): SessionConfig {
  const phase = getPhase(Math.max(1, daysActive));
  return PHASE_CONFIG[phase];
}

/**
 * Interleave items for engagement, not front-loaded by type.
 * Pattern: vocab → phrase → review → vocab → phrase → new → repeat...
 *
 * This keeps sessions varied and prevents fatigue from doing
 * all of one type before moving to the next.
 */
export function interleaveItems<T extends { type: string }>(items: T[]): T[] {
  if (items.length <= 1) return items;

  // Group by type
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const existing = groups.get(item.type) ?? [];
    existing.push(item);
    groups.set(item.type, existing);
  }

  // Interleave round-robin style
  const result: T[] = [];
  const typeOrder = ['VOCAB_DRILL', 'PHRASE_DRILL', 'REVIEW', 'NEW_READING'];
  const indices = new Map<string, number>();

  // Initialize indices
  for (const type of typeOrder) {
    indices.set(type, 0);
  }

  // Round-robin through types until all items are placed
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const type of typeOrder) {
      const group = groups.get(type);
      const idx = indices.get(type) ?? 0;
      if (group && idx < group.length) {
        result.push(group[idx]);
        indices.set(type, idx + 1);
        hasMore = true;
      }
    }
  }

  return result;
}
