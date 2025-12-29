import type { ContentSeed, SessionItem } from '@/lib/data/types';
import { getSessionConfig, interleaveItems } from './config';

/**
 * Build the session queue from content seed.
 * Dynamic composition based on learner progress (daysActive).
 * Items are interleaved for engagement.
 * Pure, deterministic, easy to test.
 */
export function buildSessionItems(content: ContentSeed, daysActive = 1): SessionItem[] {
  const config = getSessionConfig(daysActive);

  // Slice items according to config
  const vocabItems = content.vocab
    .slice(0, config.vocabCount)
    .map((vocab) => ({ type: 'VOCAB_DRILL', vocab }) as const);

  const phraseItems = content.phrases
    .slice(0, config.phraseCount)
    .map((phrase) => ({ type: 'PHRASE_DRILL', phrase }) as const);

  const reviewItems = content.review
    .slice(0, config.reviewCount)
    .map((sentence) => ({ type: 'REVIEW', sentence }) as const);

  // Reading passage with appropriate sentence count
  const readingItem = {
    type: 'NEW_READING',
    reading: {
      ...content.reading,
      sentenceIds: content.reading.sentenceIds.slice(0, config.newSentenceCount),
    },
  } as const;

  // Interleave for engagement (vocab → phrase → review → repeat, reading at end)
  const drillItems = interleaveItems([...vocabItems, ...phraseItems, ...reviewItems]);
  return [...drillItems, readingItem];
}
