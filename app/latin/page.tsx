import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllChapters, getAllVocabWords, getAllPhrases, getCorpusStats, BOOK_NAMES } from '@/lib/data/corpusPages';

export const metadata: Metadata = {
  title: 'Learn Latin with Caesar\'s De Bello Gallico | Caesar in a Year',
  description:
    'Free Latin vocabulary, phrases, and parallel text from Caesar\'s De Bello Gallico. Browse all 8 books, 366 chapters, and over 1,000 vocabulary words with definitions and example sentences.',
  openGraph: {
    title: 'Learn Latin with Caesar\'s De Bello Gallico',
    description: 'Free Latin vocabulary, phrases, and parallel text from all 8 books of De Bello Gallico.',
  },
};

export default function LatinIndexPage() {
  const stats = getCorpusStats();
  const chapters = getAllChapters();
  const vocab = getAllVocabWords();
  const phrases = getAllPhrases();

  // Group chapters by book
  const bookChapters = new Map<string, { book: string; chapter: string }[]>();
  for (const ch of chapters) {
    const existing = bookChapters.get(ch.book) ?? [];
    existing.push(ch);
    bookChapters.set(ch.book, existing);
  }

  // Sort chapters within each book numerically
  for (const chs of bookChapters.values()) {
    chs.sort((a, b) => Number(a.chapter) - Number(b.chapter));
  }

  // Featured vocab: first 24 words alphabetically
  const featuredVocab = [...vocab]
    .sort((a, b) => a.latinWord.localeCompare(b.latinWord))
    .slice(0, 24);

  // Featured phrases: first 12
  const featuredPhrases = phrases.slice(0, 12);

  return (
    <div>
      {/* Hero */}
      <section className="mb-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Caesar&apos;s <em>De Bello Gallico</em>
        </h1>
        <p className="mt-3 text-lg text-text-secondary">
          Browse {stats.sentences.toLocaleString()} sentences across {stats.books} books and{' '}
          {stats.chapters} chapters. Vocabulary definitions, phrase breakdowns, and parallel
          Latin-English text — all free.
        </p>
        <p className="mt-4">
          <Link
            href="/sign-up"
            className="inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Practice with AI Grading
          </Link>
        </p>
      </section>

      {/* Books & Chapters */}
      <section id="books" className="mb-12">
        <h2 className="font-display text-2xl font-semibold">Books &amp; Chapters</h2>
        <div className="mt-4 space-y-6">
          {[...bookChapters.entries()]
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([book, chs]) => (
              <div key={book}>
                <h3 className="font-display text-lg font-medium">
                  Book {book}
                  <span className="ml-2 text-sm font-normal text-text-muted">
                    {BOOK_NAMES[book]} — {chs.length} chapters
                  </span>
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {chs.map((ch) => (
                    <Link
                      key={`${ch.book}.${ch.chapter}`}
                      href={`/latin/dbg/${ch.book}/${ch.chapter}`}
                      className="rounded border border-border px-2.5 py-1 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent"
                    >
                      {ch.book}.{ch.chapter}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Vocabulary */}
      <section id="vocabulary" className="mb-12">
        <h2 className="font-display text-2xl font-semibold">
          Vocabulary
          <span className="ml-2 text-sm font-normal text-text-muted">
            {stats.vocab.toLocaleString()} words
          </span>
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {featuredVocab.map((v) => (
            <Link
              key={v.latinWord}
              href={`/latin/word/${encodeURIComponent(v.latinWord)}`}
              className="rounded border border-border px-3 py-2 transition-colors hover:border-accent"
            >
              <span className="font-serif font-medium">{v.latinWord}</span>
              <span className="block text-sm text-text-muted">{v.meaning}</span>
            </Link>
          ))}
        </div>
        <p className="mt-4">
          <Link href="/latin/word/divido" className="text-accent hover:underline">
            Browse all vocabulary →
          </Link>
        </p>
      </section>

      {/* Phrases */}
      <section id="phrases" className="mb-12">
        <h2 className="font-display text-2xl font-semibold">
          Phrases
          <span className="ml-2 text-sm font-normal text-text-muted">
            {stats.phrases.toLocaleString()} phrases
          </span>
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {featuredPhrases.map((p) => (
            <Link
              key={p.slug}
              href={`/latin/phrase/${p.slug}`}
              className="rounded border border-border px-3 py-2 transition-colors hover:border-accent"
            >
              <span className="font-serif">{p.latin}</span>
              <span className="ml-2 text-sm text-text-muted">{p.english}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Caesar in a Year',
            description:
              'Learn Latin by reading Caesar\'s De Bello Gallico with AI-powered translation practice.',
            url: process.env.NEXT_PUBLIC_APP_URL || 'https://caesarinayear.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${process.env.NEXT_PUBLIC_APP_URL || 'https://caesarinayear.com'}/latin/word/{search_term_string}`,
              },
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
    </div>
  );
}
