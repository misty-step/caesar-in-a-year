import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapToReading, type SentenceDoc } from '@/lib/data/convexAdapter';

vi.mock('@/lib/data/enrichedCorpus', () => ({
  getVocabForSentences: vi.fn(),
  isEnrichedCorpusLoaded: vi.fn(),
}));

import { getVocabForSentences, isEnrichedCorpusLoaded } from '@/lib/data/enrichedCorpus';

const mockedGetVocab = getVocabForSentences as ReturnType<typeof vi.fn>;
const mockedIsLoaded = isEnrichedCorpusLoaded as ReturnType<typeof vi.fn>;

const SENTENCES: SentenceDoc[] = [
  { sentenceId: 'bg.1.1.1', latin: 'Gallia est omnis divisa in partes tres.', referenceTranslation: 'All Gaul is divided into three parts.', difficulty: 1 },
  { sentenceId: 'bg.1.1.2', latin: 'Quarum unam incolunt Belgae.', referenceTranslation: 'The Belgae inhabit one of these.', difficulty: 1 },
];

describe('mapToReading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsLoaded.mockReturnValue(true);
  });

  it('populates glossary from enriched corpus vocabulary', () => {
    mockedGetVocab.mockReturnValue([
      { latinWord: 'divisa', meaning: 'divided', questionType: 'latin_to_english', question: '', answer: '', sourceSentenceId: 'bg.1.1.1' },
      { latinWord: 'incolunt', meaning: 'inhabit', questionType: 'latin_to_english', question: '', answer: '', sourceSentenceId: 'bg.1.1.2' },
    ]);

    const result = mapToReading(SENTENCES);

    expect(mockedGetVocab).toHaveBeenCalledWith(['bg.1.1.1', 'bg.1.1.2']);
    expect(result.glossary).toEqual({
      divisa: 'divided',
      incolunt: 'inhabit',
    });
  });

  it('degrades gracefully to empty glossary when no vocab exists', () => {
    mockedGetVocab.mockReturnValue([]);

    const result = mapToReading(SENTENCES);

    expect(result.glossary).toEqual({});
  });

  it('degrades gracefully when enriched corpus is not loaded', () => {
    mockedIsLoaded.mockReturnValue(false);

    const result = mapToReading(SENTENCES);

    expect(result.glossary).toEqual({});
    expect(mockedGetVocab).not.toHaveBeenCalled();
  });

  it('lowercases glossary keys for case-insensitive lookup', () => {
    mockedGetVocab.mockReturnValue([
      { latinWord: 'Gallia', meaning: 'Gaul', questionType: 'latin_to_english', question: '', answer: '', sourceSentenceId: 'bg.1.1.1' },
    ]);

    const result = mapToReading(SENTENCES);

    expect(result.glossary).toEqual({ gallia: 'Gaul' });
  });

  it('throws on empty input', () => {
    expect(() => mapToReading([])).toThrow('mapToReading requires at least one sentence');
  });

  it('preserves other ReadingPassage fields correctly', () => {
    mockedGetVocab.mockReturnValue([]);

    const result = mapToReading(SENTENCES);

    expect(result.id).toBe('reading-bg.1.1.1');
    expect(result.title).toBe('De Bello Gallico 1.1');
    expect(result.latinText).toEqual([SENTENCES[0].latin, SENTENCES[1].latin]);
    expect(result.sentenceIds).toEqual(['bg.1.1.1', 'bg.1.1.2']);
    expect(result.gistQuestion).toBe('Translate this passage into natural English.');
    expect(result.referenceGist).toBe('All Gaul is divided into three parts. The Belgae inhabit one of these.');
  });
});
