/**
 * Enriched Corpus Loader
 *
 * Provides access to pre-generated vocabulary and phrase cards
 * from the enriched corpus. Cards are static curriculum content,
 * created once during corpus enrichment.
 *
 * Usage:
 * 1. Load corpus: await loadEnrichedCorpus()
 * 2. Get cards for sentences: getVocabForSentences(ids), getPhrasesForSentences(ids)
 * 3. Create user cards when they encounter new sentences
 */

import { promises as fs } from 'fs';
import path from 'path';

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

interface EnrichedCorpus {
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

// Indexed lookups for efficient access
let vocabBySentence: Map<string, EnrichedVocab[]> | null = null;
let phrasesBySentence: Map<string, EnrichedPhrase[]> | null = null;
let loaded = false;

const ENRICHED_CORPUS_PATH = path.join(process.cwd(), 'content', 'corpus-enriched.json');

/**
 * Load and index the enriched corpus.
 * Safe to call multiple times - only loads once.
 */
export async function loadEnrichedCorpus(): Promise<void> {
  if (loaded) return;

  try {
    const raw = await fs.readFile(ENRICHED_CORPUS_PATH, 'utf-8');
    const corpus: EnrichedCorpus = JSON.parse(raw);

    // Build sentence ID indexes for O(1) lookup
    vocabBySentence = new Map();
    phrasesBySentence = new Map();

    for (const v of corpus.vocab) {
      const existing = vocabBySentence.get(v.sourceSentenceId) ?? [];
      existing.push(v);
      vocabBySentence.set(v.sourceSentenceId, existing);
    }

    for (const p of corpus.phrases) {
      const existing = phrasesBySentence.get(p.sourceSentenceId) ?? [];
      existing.push(p);
      phrasesBySentence.set(p.sourceSentenceId, existing);
    }

    loaded = true;
    console.log(
      `[EnrichedCorpus] Loaded ${corpus.vocab.length} vocab, ${corpus.phrases.length} phrases`
    );
  } catch (error) {
    // Not an error - corpus may not be enriched yet
    console.warn(`[EnrichedCorpus] Could not load enriched corpus: ${error}`);
    vocabBySentence = new Map();
    phrasesBySentence = new Map();
    loaded = true;
  }
}

/**
 * Get vocabulary items for specific sentence IDs.
 * Returns empty array if corpus not loaded or no vocab for those sentences.
 */
export function getVocabForSentences(sentenceIds: string[]): EnrichedVocab[] {
  if (!vocabBySentence) return [];

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
 * Returns empty array if corpus not loaded or no phrases for those sentences.
 */
export function getPhrasesForSentences(sentenceIds: string[]): EnrichedPhrase[] {
  if (!phrasesBySentence) return [];

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
 * Check if enriched corpus is available.
 */
export function isEnrichedCorpusLoaded(): boolean {
  return loaded && vocabBySentence !== null && vocabBySentence.size > 0;
}
