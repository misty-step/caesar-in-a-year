/**
 * Enriched Corpus Access
 *
 * Provides access to pre-generated vocabulary and phrase cards
 * from the enriched corpus. Uses a build-time static import so
 * Vercel's file tracing bundles the JSON automatically.
 *
 * Maps are indexed at module load time for O(1) lookup.
 */

import corpusJson from '@/content/corpus-enriched.json';

export interface EnrichedVocab {
  latinWord: string;
  meaning: string;
  questionType: 'latin_to_english'; // Meaning-focused only
  question: string;
  answer: string;
  sourceSentenceId: string;
}

export interface EnrichedPhrase {
  latin: string;
  english: string;
  sourceSentenceId: string;
}

interface RawCorpus {
  metadata: {
    version: string;
    generated_at: string;
    sentence_count: number;
    vocab_count: number;
    phrase_count: number;
  };
  sentences: unknown[];
  vocab: EnrichedVocab[];
  phrases: EnrichedPhrase[];
}

const corpus = corpusJson as unknown as RawCorpus;

// Build sentence ID indexes at module load time for O(1) lookup
const vocabBySentence = new Map<string, EnrichedVocab[]>();
const phrasesBySentence = new Map<string, EnrichedPhrase[]>();

for (const v of corpus.vocab) {
  // Skip legacy grammar questions — only meaning-focused cards
  if (v.questionType !== 'latin_to_english') continue;

  const existing = vocabBySentence.get(v.sourceSentenceId) ?? [];
  existing.push(v);
  vocabBySentence.set(v.sourceSentenceId, existing);
}

for (const p of corpus.phrases) {
  const existing = phrasesBySentence.get(p.sourceSentenceId) ?? [];
  existing.push(p);
  phrasesBySentence.set(p.sourceSentenceId, existing);
}

/**
 * Get vocabulary items for specific sentence IDs.
 * Returns empty array if no vocab exists for those sentences.
 */
export function getVocabForSentences(sentenceIds: string[]): EnrichedVocab[] {
  const results: EnrichedVocab[] = [];
  const seen = new Set<string>(); // Dedupe by latinWord

  for (const id of sentenceIds) {
    const vocab = vocabBySentence.get(id) ?? [];
    for (const v of vocab) {
      if (!seen.has(v.latinWord)) {
        seen.add(v.latinWord);
        results.push(v);
      }
    }
  }

  return results;
}

/**
 * Get phrase items for specific sentence IDs.
 * Returns empty array if no phrases exist for those sentences.
 */
export function getPhrasesForSentences(sentenceIds: string[]): EnrichedPhrase[] {
  const results: EnrichedPhrase[] = [];
  const seen = new Set<string>(); // Dedupe by latin text

  for (const id of sentenceIds) {
    const phrases = phrasesBySentence.get(id) ?? [];
    for (const p of phrases) {
      if (!seen.has(p.latin)) {
        seen.add(p.latin);
        results.push(p);
      }
    }
  }

  return results;
}

/**
 * Check if enriched corpus data is available.
 */
export function isEnrichedCorpusLoaded(): boolean {
  return vocabBySentence.size > 0;
}
