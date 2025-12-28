import { describe, expect, it } from 'vitest';
import { buildSessionItems } from '../builder';
import { advanceSession } from '../advance';
import type { ContentSeed, Session } from '@/lib/data/types';

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
    sentenceIds: ['test.1.1.1'],
    glossary: {},
    gistQuestion: 'q',
    referenceGist: 'ref',
  },
};

describe('buildSessionItems', () => {
  it('returns 3 review items followed by 1 reading', () => {
    const items = buildSessionItems(sampleContent);
    expect(items).toHaveLength(4);
    expect(items.slice(0, 3).every((i) => i.type === 'REVIEW')).toBe(true);
    expect(items[3].type).toBe('NEW_READING');
  });
});

describe('advanceSession', () => {
  const baseSession: Session = {
    id: 'sess1',
    userId: 'u1',
    items: buildSessionItems(sampleContent),
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
    const nearEnd = { ...baseSession, currentIndex: 3 };
    const result = advanceSession(nearEnd);
    expect(result.nextIndex).toBe(4);
    expect(result.status).toBe('complete');
  });

  it('is idempotent once complete', () => {
    const done = { ...baseSession, currentIndex: 3, status: 'complete' as const };
    const result = advanceSession(done);
    expect(result.nextIndex).toBe(3);
    expect(result.status).toBe('complete');
  });
});
