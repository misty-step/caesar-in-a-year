import type { MetadataRoute } from 'next';
import { getAllChapters, getAllVocabWords, getAllPhrases } from '@/lib/data/corpusPages';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/latin`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Chapter pages (highest content value)
  for (const ch of getAllChapters()) {
    entries.push({
      url: `${baseUrl}/latin/dbg/${ch.book}/${ch.chapter}`,
      changeFrequency: 'monthly',
      priority: 0.8,
    });
  }

  // Vocab pages
  for (const v of getAllVocabWords()) {
    entries.push({
      url: `${baseUrl}/latin/word/${encodeURIComponent(v.latinWord)}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  // Phrase pages
  for (const p of getAllPhrases()) {
    entries.push({
      url: `${baseUrl}/latin/phrase/${p.slug}`,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  return entries;
}
