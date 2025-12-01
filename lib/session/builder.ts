import type { ContentSeed, SessionItem } from '@/lib/data/types';

/**
 * Build the session queue: current spec = 3 review items + 1 new reading.
 * Pure, deterministic, easy to test.
 */
export function buildSessionItems(content: ContentSeed): SessionItem[] {
  const reviewItems = content.review.map((sentence) => ({ type: 'REVIEW', sentence }) as const);
  const readingItem = { type: 'NEW_READING', reading: content.reading } as const;
  return [...reviewItems, readingItem];
}
