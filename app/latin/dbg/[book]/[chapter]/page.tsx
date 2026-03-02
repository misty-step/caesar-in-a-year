import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllChapters, getChapter, slugify, BOOK_NAMES } from '@/lib/data/corpusPages';

interface PageProps {
  params: Promise<{ book: string; chapter: string }>;
}

export function generateStaticParams() {
  return getAllChapters().map((ch) => ({
    book: ch.book,
    chapter: ch.chapter,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { book, chapter } = await params;
  const data = getChapter(book, chapter);
  if (!data) return { title: 'Chapter Not Found' };

  const bookName = BOOK_NAMES[book] ?? '';
  return {
    title: `De Bello Gallico Book ${book}, Chapter ${chapter} | Caesar in a Year`,
    description: `Read Caesar's De Bello Gallico Book ${book} (${bookName}), Chapter ${chapter} in parallel Latin and English. ${data.sentences.length} sentences with vocabulary and phrase breakdowns.`,
  };
}

export default async function ChapterPage({ params }: PageProps) {
  const { book, chapter } = await params;
  const data = getChapter(book, chapter);
  if (!data) notFound();

  const bookName = BOOK_NAMES[book] ?? '';

  // Compute prev/next chapter navigation
  const allChapters = getAllChapters()
    .sort((a, b) => Number(a.book) - Number(b.book) || Number(a.chapter) - Number(b.chapter));
  const currentIdx = allChapters.findIndex(
    (ch) => ch.book === book && ch.chapter === chapter
  );
  const prev = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const next = currentIdx < allChapters.length - 1 ? allChapters[currentIdx + 1] : null;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/latin" className="hover:text-text-primary">
          Home
        </Link>
        <span className="mx-1">/</span>
        <Link href="/latin#books" className="hover:text-text-primary">
          Books
        </Link>
        <span className="mx-1">/</span>
        <span className="text-text-secondary">
          Book {book}, Chapter {chapter}
        </span>
      </nav>

      {/* Header */}
      <h1 className="font-display text-3xl font-bold">
        Book {book}, Chapter {chapter}
      </h1>
      {bookName && (
        <p className="mt-1 text-text-muted">{bookName}</p>
      )}
      <p className="mt-2 text-text-secondary">
        {data.sentences.length} sentences
        {data.vocab.length > 0 && ` · ${data.vocab.length} vocabulary words`}
        {data.phrases.length > 0 && ` · ${data.phrases.length} phrases`}
      </p>

      {/* Parallel text */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Text</h2>
        <div className="mt-4 space-y-4">
          {data.sentences.map((s, i) => (
            <div key={s.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xs font-medium text-text-muted">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-serif text-lg leading-relaxed">{s.latin}</p>
                  <p className="mt-2 text-text-secondary">{s.referenceTranslation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Vocabulary glossary */}
      {data.vocab.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Vocabulary</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.vocab.map((v) => (
              <Link
                key={v.latinWord}
                href={`/latin/word/${encodeURIComponent(v.latinWord)}`}
                className="flex items-baseline gap-2 rounded border border-border px-3 py-2 transition-colors hover:border-accent"
              >
                <span className="font-serif font-medium">{v.latinWord}</span>
                <span className="text-sm text-text-muted">{v.meaning}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Phrase breakdowns */}
      {data.phrases.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Phrases</h2>
          <div className="mt-3 space-y-2">
            {data.phrases.map((p) => (
              <Link
                key={slugify(p.latin)}
                href={`/latin/phrase/${slugify(p.latin)}`}
                className="flex items-baseline gap-3 rounded border border-border px-3 py-2 transition-colors hover:border-accent"
              >
                <span className="font-serif">{p.latin}</span>
                <span className="text-sm text-text-muted">{p.english}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Prev/Next nav */}
      <nav className="mt-10 flex items-center justify-between border-t border-border pt-6">
        {prev ? (
          <Link
            href={`/latin/dbg/${prev.book}/${prev.chapter}`}
            className="text-sm text-accent hover:underline"
          >
            ← Book {prev.book}, Chapter {prev.chapter}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/latin/dbg/${next.book}/${next.chapter}`}
            className="text-sm text-accent hover:underline"
          >
            Book {next.book}, Chapter {next.chapter} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {/* CTA */}
      <section className="mt-8 rounded-lg border border-accent/20 bg-accent-faint p-6 text-center">
        <h2 className="font-display text-lg font-semibold">
          Read this chapter interactively
        </h2>
        <p className="mt-1 text-text-secondary">
          Practice translating each sentence with AI-powered grading and spaced repetition.
        </p>
        <Link
          href="/sign-up"
          className="mt-4 inline-block rounded-lg bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Start Learning Free
        </Link>
      </section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: `De Bello Gallico Book ${book}, Chapter ${chapter}`,
            author: {
              '@type': 'Person',
              name: 'Gaius Julius Caesar',
            },
            inLanguage: ['la', 'en'],
            isPartOf: {
              '@type': 'Book',
              name: 'De Bello Gallico',
              author: { '@type': 'Person', name: 'Gaius Julius Caesar' },
            },
            description: `Parallel Latin-English text of De Bello Gallico Book ${book}, Chapter ${chapter}${bookName ? ` (${bookName})` : ''}.`,
          }),
        }}
      />
    </div>
  );
}
