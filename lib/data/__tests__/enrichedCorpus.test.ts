import { describe, it, expect } from 'vitest';
import {
  getVocabForSentences,
  getPhrasesForSentences,
  isEnrichedCorpusLoaded,
} from '@/lib/data/enrichedCorpus';

describe('enrichedCorpus (static import)', () => {
  it('isEnrichedCorpusLoaded returns true — corpus is indexed at module load', () => {
    // If static import fails, this would be false and all callers would silently degrade
    expect(isEnrichedCorpusLoaded()).toBe(true);
  });

  it('getVocabForSentences returns vocab for a known sentence', () => {
    // bg.1.1.2 has a latin_to_english vocab card (confirmed from corpus data)
    const vocab = getVocabForSentences(['bg.1.1.2']);
    expect(vocab.length).toBeGreaterThan(0);
    expect(vocab.every((v) => v.questionType === 'latin_to_english')).toBe(true);
    expect(vocab.every((v) => v.sourceSentenceId === 'bg.1.1.2')).toBe(true);
  });

  it('getVocabForSentences deduplicates by latinWord across sentences', () => {
    const vocab = getVocabForSentences(['bg.1.1.2', 'bg.1.1.3', 'bg.1.1.4']);
    const words = vocab.map((v) => v.latinWord);
    const uniqueWords = new Set(words);
    expect(words.length).toBe(uniqueWords.size);
  });

  it('getVocabForSentences returns empty array for unknown sentence', () => {
    expect(getVocabForSentences(['nonexistent.0.0.0'])).toEqual([]);
  });

  it('getPhrasesForSentences returns phrases for a known sentence', () => {
    // bg.1.1.1 has phrase cards (confirmed from corpus data)
    const phrases = getPhrasesForSentences(['bg.1.1.1']);
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.every((p) => p.sourceSentenceId === 'bg.1.1.1')).toBe(true);
  });

  it('getPhrasesForSentences deduplicates by latin text', () => {
    const phrases = getPhrasesForSentences(['bg.1.1.1', 'bg.1.1.2']);
    const texts = phrases.map((p) => p.latin);
    const unique = new Set(texts);
    expect(texts.length).toBe(unique.size);
  });

  it('getPhrasesForSentences returns empty array for unknown sentence', () => {
    expect(getPhrasesForSentences(['nonexistent.0.0.0'])).toEqual([]);
  });
});
