/**
 * Corpus Data Access for pSEO Pages
 *
 * Provides indexed lookups over the enriched corpus for statically-generated
 * public pages. Uses the same static import pattern as enrichedCorpus.ts
 * so Vercel's file tracing bundles the JSON automatically.
 *
 * All indexes built at module load time for O(1) lookup.
 */

import corpusJson from '@/content/corpus-enriched.json';

// === Types ===

export interface CorpusSentence {
  id: string;
  latin: string;
  referenceTranslation: string;
  difficulty: number;
  order: number;
  alignmentConfidence: number;
}

export interface CorpusVocab {
  latinWord: string;
  meaning: string;
  questionType: string;
  question: string;
  answer: string;
  sourceSentenceId: string;
}

export interface CorpusPhrase {
  latin: string;
  english: string;
  sourceSentenceId: string;
}

export interface ChapterInfo {
  book: string;
  chapter: string;
  sentences: CorpusSentence[];
  vocab: CorpusVocab[];
  phrases: CorpusPhrase[];
}

interface RawCorpus {
  metadata: {
    version: string;
    generated_at: string;
    sentence_count: number;
    vocab_count: number;
    phrase_count: number;
  };
  sentences: CorpusSentence[];
  vocab: CorpusVocab[];
  phrases: CorpusPhrase[];
}

// === Corpus data ===

const corpus = corpusJson as RawCorpus;

// === Slug utility ===

export function slugify(latin: string): string {
  return latin
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// === Indexes (built once at module load) ===

/** sentence by ID */
const sentenceById = new Map<string, CorpusSentence>();
for (const s of corpus.sentences) {
  sentenceById.set(s.id, s);
}

/** vocab grouped by latinWord (deduped, first occurrence wins) */
const vocabByWord = new Map<string, CorpusVocab>();
const vocabBySentence = new Map<string, CorpusVocab[]>();
for (const v of corpus.vocab) {
  if (!vocabByWord.has(v.latinWord)) {
    vocabByWord.set(v.latinWord, v);
  }
  const existing = vocabBySentence.get(v.sourceSentenceId) ?? [];
  existing.push(v);
  vocabBySentence.set(v.sourceSentenceId, existing);
}

/** phrases grouped by slug (deduped) and by sentence */
const phraseBySlug = new Map<string, CorpusPhrase>();
const phrasesBySentence = new Map<string, CorpusPhrase[]>();
for (const p of corpus.phrases) {
  const slug = slugify(p.latin);
  if (!phraseBySlug.has(slug)) {
    phraseBySlug.set(slug, p);
  }
  const existing = phrasesBySentence.get(p.sourceSentenceId) ?? [];
  existing.push(p);
  phrasesBySentence.set(p.sourceSentenceId, existing);
}

/** sentences grouped by chapter key "bg.X.Y" */
const chapterSentences = new Map<string, CorpusSentence[]>();
for (const s of corpus.sentences) {
  const parts = s.id.split('.');
  const chapterKey = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const existing = chapterSentences.get(chapterKey) ?? [];
  existing.push(s);
  chapterSentences.set(chapterKey, existing);
}

// Sort sentences within each chapter by order
for (const sentences of chapterSentences.values()) {
  sentences.sort((a, b) => a.order - b.order);
}

// === Public API ===

/** All unique vocab entries (one per latinWord). */
export function getAllVocabWords(): CorpusVocab[] {
  return [...vocabByWord.values()];
}

/** Single vocab word + all sentences containing it. */
export function getVocabByWord(word: string): {
  vocab: CorpusVocab;
  sentences: CorpusSentence[];
} | null {
  const vocab = vocabByWord.get(word);
  if (!vocab) return null;

  // Find all occurrences of this word across the corpus
  const sentenceIds = corpus.vocab
    .filter((v) => v.latinWord === word)
    .map((v) => v.sourceSentenceId);

  const sentences = sentenceIds
    .map((id) => sentenceById.get(id))
    .filter((s): s is CorpusSentence => !!s);

  return { vocab, sentences };
}

/** All unique phrases. */
export function getAllPhrases(): (CorpusPhrase & { slug: string })[] {
  return [...phraseBySlug.entries()].map(([slug, phrase]) => ({
    ...phrase,
    slug,
  }));
}

/** Single phrase by slug + source sentences. */
export function getPhraseBySlug(slug: string): {
  phrase: CorpusPhrase;
  sentences: CorpusSentence[];
} | null {
  const phrase = phraseBySlug.get(slug);
  if (!phrase) return null;

  // Find all occurrences
  const sentenceIds = corpus.phrases
    .filter((p) => slugify(p.latin) === slug)
    .map((p) => p.sourceSentenceId);

  const sentences = sentenceIds
    .map((id) => sentenceById.get(id))
    .filter((s): s is CorpusSentence => !!s);

  return { phrase, sentences };
}

/** All chapter keys as {book, chapter} pairs. */
export function getAllChapters(): { book: string; chapter: string }[] {
  return [...chapterSentences.keys()].map((key) => {
    const [, book, chapter] = key.split('.');
    return { book, chapter };
  });
}

/** Full chapter data: sentences in order + related vocab + phrases. */
export function getChapter(
  book: string,
  chapter: string
): ChapterInfo | null {
  const key = `bg.${book}.${chapter}`;
  const sentences = chapterSentences.get(key);
  if (!sentences) return null;

  const sentenceIds = sentences.map((s) => s.id);

  // Collect vocab for all sentences, deduped by latinWord
  const seenWords = new Set<string>();
  const vocab: CorpusVocab[] = [];
  for (const id of sentenceIds) {
    for (const v of vocabBySentence.get(id) ?? []) {
      if (!seenWords.has(v.latinWord)) {
        seenWords.add(v.latinWord);
        vocab.push(v);
      }
    }
  }

  // Collect phrases for all sentences, deduped by latin text
  const seenPhrases = new Set<string>();
  const phrases: CorpusPhrase[] = [];
  for (const id of sentenceIds) {
    for (const p of phrasesBySentence.get(id) ?? []) {
      if (!seenPhrases.has(p.latin)) {
        seenPhrases.add(p.latin);
        phrases.push(p);
      }
    }
  }

  return { book, chapter, sentences, vocab, phrases };
}

/** Vocab from the same chapter as the given word (for internal linking). */
export function getRelatedVocab(word: string): CorpusVocab[] {
  const entry = vocabByWord.get(word);
  if (!entry) return [];

  const [prefix, book, chapter] = entry.sourceSentenceId.split('.');
  const key = `${prefix}.${book}.${chapter}`;
  const sentences = chapterSentences.get(key) ?? [];
  const sentenceIds = new Set(sentences.map((s) => s.id));

  const seen = new Set<string>();
  const related: CorpusVocab[] = [];
  for (const id of sentenceIds) {
    for (const v of vocabBySentence.get(id) ?? []) {
      if (v.latinWord !== word && !seen.has(v.latinWord)) {
        seen.add(v.latinWord);
        related.push(v);
      }
    }
  }
  return related;
}

/** Phrases from the same chapter as the given phrase slug. */
export function getRelatedPhrases(slug: string): CorpusPhrase[] {
  const phrase = phraseBySlug.get(slug);
  if (!phrase) return [];

  const [prefix, book, chapter] = phrase.sourceSentenceId.split('.');
  const key = `${prefix}.${book}.${chapter}`;
  const sentences = chapterSentences.get(key) ?? [];
  const sentenceIds = new Set(sentences.map((s) => s.id));

  const seen = new Set<string>();
  const related: CorpusPhrase[] = [];
  for (const id of sentenceIds) {
    for (const p of phrasesBySentence.get(id) ?? []) {
      const pSlug = slugify(p.latin);
      if (pSlug !== slug && !seen.has(pSlug)) {
        seen.add(pSlug);
        related.push(p);
      }
    }
  }
  return related;
}

/** Total counts for sitemap/index page. */
export function getCorpusStats() {
  return {
    sentences: corpus.sentences.length,
    vocab: vocabByWord.size,
    phrases: phraseBySlug.size,
    chapters: chapterSentences.size,
    books: new Set(
      [...chapterSentences.keys()].map((k) => k.split('.')[1])
    ).size,
  };
}
