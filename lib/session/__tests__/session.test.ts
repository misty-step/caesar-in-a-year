import { describe, expect, it } from 'vitest';
import { buildSessionItems } from '../builder';
import { advanceSession } from '../advance';
import { getSessionConfig, interleaveItems } from '../config';
import type { ContentSeed, Session, SessionItem } from '@/lib/data/types';

const sampleContent: ContentSeed = {
  review: [
    { id: 's1', latin: 'a', referenceTranslation: 'a' },
    { id: 's2', latin: 'b', referenceTranslation: 'b' },
    { id: 's3', latin: 'c', referenceTranslation: 'c' },
  ],
  reading: {
    id: 'r1',
    title: 'Reading',
    latinText: ['foo'],
    sentenceIds: ['test.1.1.1', 'test.1.1.2'],
    glossary: {},
    gistQuestion: 'q',
    referenceGist: 'ref',
  },
  vocab: [],
  phrases: [],
};

describe('getSessionConfig', () => {
  it('returns beginner config for days 1-60', () => {
    expect(getSessionConfig(1)).toEqual({ vocabCount: 4, phraseCount: 2, reviewCount: 2, newSentenceCount: 2 });
    expect(getSessionConfig(60)).toEqual({ vocabCount: 4, phraseCount: 2, reviewCount: 2, newSentenceCount: 2 });
  });

  it('returns early-mid config for days 61-180', () => {
    expect(getSessionConfig(61)).toEqual({ vocabCount: 2, phraseCount: 2, reviewCount: 3, newSentenceCount: 4 });
    expect(getSessionConfig(180)).toEqual({ vocabCount: 2, phraseCount: 2, reviewCount: 3, newSentenceCount: 4 });
  });

  it('returns mid-late config for days 181-300', () => {
    expect(getSessionConfig(181)).toEqual({ vocabCount: 1, phraseCount: 1, reviewCount: 3, newSentenceCount: 6 });
    expect(getSessionConfig(300)).toEqual({ vocabCount: 1, phraseCount: 1, reviewCount: 3, newSentenceCount: 6 });
  });

  it('returns advanced config for days 301+', () => {
    expect(getSessionConfig(301)).toEqual({ vocabCount: 0, phraseCount: 1, reviewCount: 3, newSentenceCount: 8 });
    expect(getSessionConfig(365)).toEqual({ vocabCount: 0, phraseCount: 1, reviewCount: 3, newSentenceCount: 8 });
  });
});

describe('interleaveItems', () => {
  it('interleaves items round-robin by type', () => {
    const items: SessionItem[] = [
      { type: 'VOCAB_DRILL', vocab: { id: 'v1', latinWord: 'a', meaning: 'a', questionType: 'latin_to_english', question: 'q', answer: 'a', sourceSentenceId: 's1' } },
      { type: 'VOCAB_DRILL', vocab: { id: 'v2', latinWord: 'b', meaning: 'b', questionType: 'latin_to_english', question: 'q', answer: 'b', sourceSentenceId: 's1' } },
      { type: 'REVIEW', sentence: { id: 's1', latin: 'a', referenceTranslation: 'a' } },
      { type: 'REVIEW', sentence: { id: 's2', latin: 'b', referenceTranslation: 'b' } },
    ];
    const result = interleaveItems(items);
    // Should alternate: VOCAB_DRILL, REVIEW, VOCAB_DRILL, REVIEW
    expect(result.map(i => i.type)).toEqual(['VOCAB_DRILL', 'REVIEW', 'VOCAB_DRILL', 'REVIEW']);
  });

  it('returns single item unchanged', () => {
    const items: SessionItem[] = [{ type: 'REVIEW', sentence: { id: 's1', latin: 'a', referenceTranslation: 'a' } }];
    expect(interleaveItems(items)).toEqual(items);
  });

  it('handles empty array', () => {
    expect(interleaveItems([])).toEqual([]);
  });
});

describe('buildSessionItems', () => {
  it('returns review items + reading for beginner (daysActive=1)', () => {
    // With beginner config: 4 vocab, 2 phrases, 2 reviews, 2 new sentences
    // Sample content has 0 vocab, 0 phrases, 3 reviews → sliced to 2
    const items = buildSessionItems(sampleContent, 1);
    expect(items).toHaveLength(3); // 2 reviews + 1 reading
    expect(items.filter(i => i.type === 'REVIEW')).toHaveLength(2);
    expect(items[items.length - 1].type).toBe('NEW_READING');
  });

  it('respects daysActive for config', () => {
    // For day 61 (early-mid): 2 vocab, 2 phrases, 3 reviews, 4 new sentences
    // Sample content has 3 reviews → all 3 used
    const items = buildSessionItems(sampleContent, 61);
    expect(items.filter(i => i.type === 'REVIEW')).toHaveLength(3);
  });

  it('slices reading sentenceIds according to config', () => {
    const items = buildSessionItems(sampleContent, 1);
    const reading = items.find(i => i.type === 'NEW_READING');
    expect(reading?.type).toBe('NEW_READING');
    if (reading?.type === 'NEW_READING') {
      // Beginner config: newSentenceCount = 2
      expect(reading.reading.sentenceIds).toHaveLength(2);
    }
  });
});

describe('advanceSession', () => {
  // buildSessionItems with beginner config gives 3 items: 2 reviews + 1 reading
  const items = buildSessionItems(sampleContent, 1);

  const baseSession: Session = {
    id: 'sess1',
    userId: 'u1',
    items,
    currentIndex: 0,
    status: 'active',
    startedAt: new Date().toISOString(),
  };

  it('moves to next item when active', () => {
    const result = advanceSession(baseSession);
    expect(result.nextIndex).toBe(1);
    expect(result.status).toBe('active');
  });

  it('marks complete when advancing from last item', () => {
    // Last item is at index 2 (3 items total)
    const nearEnd = { ...baseSession, currentIndex: 2 };
    const result = advanceSession(nearEnd);
    expect(result.nextIndex).toBe(3);
    expect(result.status).toBe('complete');
  });

  it('is idempotent once complete', () => {
    const done = { ...baseSession, currentIndex: 2, status: 'complete' as const };
    const result = advanceSession(done);
    expect(result.nextIndex).toBe(2);
    expect(result.status).toBe('complete');
  });
});
