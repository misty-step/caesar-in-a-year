import type { ContentSeed, SessionItem } from '@/lib/data/types';

/**
 * Build the session queue from content seed.
 * Current structure: vocab + phrases + reviews + new reading, interleaved.
 * Pure, deterministic, easy to test.
 */
export function buildSessionItems(content: ContentSeed): SessionItem[] {
  const vocabItems = content.vocab.map((vocab) => ({ type: 'VOCAB_DRILL', vocab }) as const);
  const phraseItems = content.phrases.map((phrase) => ({ type: 'PHRASE_DRILL', phrase }) as const);
  const reviewItems = content.review.map((sentence) => ({ type: 'REVIEW', sentence }) as const);
  const readingItem = { type: 'NEW_READING', reading: content.reading } as const;

  // Interleave: vocab + phrases first for warm-up, then reviews, then reading
  // TODO: Phase 3 will make this dynamic based on daysActive
  return [...vocabItems, ...phraseItems, ...reviewItems, readingItem];
}
