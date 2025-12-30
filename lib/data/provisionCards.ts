/**
 * Card Provisioning
 *
 * Creates user-specific vocabulary and phrase cards from the enriched corpus
 * when users encounter new sentences. Cards are created with FSRS initial state.
 */

import { fetchMutation } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import {
  loadEnrichedCorpus,
  getVocabForSentences,
  getPhrasesForSentences,
  isEnrichedCorpusLoaded,
} from './enrichedCorpus';

type ProvisionOptions = {
  token?: string;
};

type ProvisionResult = {
  vocabCreated: number;
  phrasesCreated: number;
  vocabSkipped: number;
  phrasesSkipped: number;
};

/**
 * Provision vocabulary and phrase cards for upcoming sentences.
 *
 * Call this before a session with new sentences to ensure
 * the user has drill cards for the vocabulary they'll encounter.
 *
 * Safe to call multiple times - existing cards are skipped via deduplication.
 */
export async function provisionCardsForSentences(
  userId: string,
  sentenceIds: string[],
  options?: ProvisionOptions
): Promise<ProvisionResult> {
  // Ensure enriched corpus is loaded
  await loadEnrichedCorpus();

  if (!isEnrichedCorpusLoaded()) {
    return { vocabCreated: 0, phrasesCreated: 0, vocabSkipped: 0, phrasesSkipped: 0 };
  }

  // Get enriched data for these sentences
  const vocab = getVocabForSentences(sentenceIds);
  const phrases = getPhrasesForSentences(sentenceIds);

  if (vocab.length === 0 && phrases.length === 0) {
    return { vocabCreated: 0, phrasesCreated: 0, vocabSkipped: 0, phrasesSkipped: 0 };
  }

  const convexOptions = options?.token ? { token: options.token } : undefined;
  let vocabCreated = 0;
  let phrasesCreated = 0;
  let vocabSkipped = 0;
  let phrasesSkipped = 0;

  // Create vocab cards (deduplication handled by Convex mutation)
  const vocabPromises = vocab.map(async (v) => {
    try {
      const result = await fetchMutation(
        api.vocab.create,
        {
          userId,
          latinWord: v.latinWord,
          meaning: v.meaning,
          questionType: v.questionType,
          question: v.question,
          answer: v.answer,
          sourceSentenceId: v.sourceSentenceId,
        },
        convexOptions
      );
      if (result.isNew) {
        vocabCreated++;
      } else {
        vocabSkipped++;
      }
    } catch (error) {
      console.error(`[ProvisionCards] Failed to create vocab card for ${v.latinWord}:`, error);
    }
  });

  // Create phrase cards (deduplication handled by Convex mutation)
  const phrasePromises = phrases.map(async (p) => {
    try {
      const result = await fetchMutation(
        api.phrases.create,
        {
          userId,
          latin: p.latin,
          english: p.english,
          sourceSentenceId: p.sourceSentenceId,
        },
        convexOptions
      );
      if (result.isNew) {
        phrasesCreated++;
      } else {
        phrasesSkipped++;
      }
    } catch (error) {
      console.error(`[ProvisionCards] Failed to create phrase card for ${p.latin}:`, error);
    }
  });

  // Run all in parallel
  await Promise.all([...vocabPromises, ...phrasePromises]);

  if (vocabCreated > 0 || phrasesCreated > 0) {
    console.log(
      `[ProvisionCards] Created ${vocabCreated} vocab, ${phrasesCreated} phrases for user ${userId.slice(0, 8)}...`
    );
  }

  return { vocabCreated, phrasesCreated, vocabSkipped, phrasesSkipped };
}
