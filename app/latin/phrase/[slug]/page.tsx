import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllPhrases,
  getAllVocabWords,
  getPhraseBySlug,
  getRelatedPhrases,
  slugify,
} from '@/lib/data/corpusPages';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPhrases().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = getPhraseBySlug(slug);
  if (!data) return { title: 'Phrase Not Found' };

  const { phrase } = data;
  return {
    title: `${phrase.latin} — Latin Phrase | Caesar in a Year`,
    description: `"${phrase.latin}" means "${phrase.english}". Learn this Latin phrase from Caesar's De Bello Gallico with context and practice.`,
  };
}

export default async function PhrasePage({ params }: PageProps) {
  const { slug } = await params;
  const data = getPhraseBySlug(slug);
  if (!data) notFound();

  const { phrase, sentences } = data;
  const related = getRelatedPhrases(slug).slice(0, 8);

  // Chapter info from source sentence
  const [, book, chapter] = phrase.sourceSentenceId.split('.');

  // Vocab from the same sentences
  const allVocab = getAllVocabWords();
  const sentenceIds = new Set(sentences.map((s) => s.id));
  const relatedVocab = allVocab
    .filter((v) => sentenceIds.has(v.sourceSentenceId))
    .slice(0, 6);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/latin" className="hover:text-text-primary">
          Home
        </Link>
        <span className="mx-1">/</span>
        <Link href="/latin#phrases" className="hover:text-text-primary">
          Phrases
        </Link>
        <span className="mx-1">/</span>
        <span className="text-text-secondary">{phrase.latin}</span>
      </nav>

      {/* Header */}
      <h1 className="font-display text-3xl font-bold font-serif">{phrase.latin}</h1>
      <p className="mt-2 text-lg text-text-secondary">&ldquo;{phrase.english}&rdquo;</p>

      {/* Source context */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">In Context</h2>
        <div className="mt-4 space-y-4">
          {sentences.slice(0, 5).map((s) => {
            const [, sBook, sChapter] = s.id.split('.');
            return (
              <div key={s.id} className="rounded-lg border border-border p-4">
                <p className="font-serif text-lg leading-relaxed">{s.latin}</p>
                <p className="mt-2 text-text-secondary">{s.referenceTranslation}</p>
                <p className="mt-1 text-xs text-text-muted">
                  <Link
                    href={`/latin/dbg/${sBook}/${sChapter}`}
                    className="hover:text-accent"
                  >
                    Book {sBook}, Chapter {sChapter}
                  </Link>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Related vocabulary */}
      {relatedVocab.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Vocabulary in this Passage</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {relatedVocab.map((v) => (
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
        </section>
      )}

      {/* Related phrases */}
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">
            More Phrases from Book {book}, Chapter {chapter}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {related.map((p) => (
              <Link
                key={slugify(p.latin)}
                href={`/latin/phrase/${slugify(p.latin)}`}
                className="rounded border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent"
              >
                <span className="font-serif">{p.latin}</span>
                <span className="ml-1.5 text-text-muted">{p.english}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mt-10 rounded-lg border border-accent/20 bg-accent-faint p-6 text-center">
        <h2 className="font-display text-lg font-semibold">Practice translating with AI</h2>
        <p className="mt-1 text-text-secondary">
          Get instant feedback on your Latin translations with AI-powered grading.
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
            '@type': 'DefinedTerm',
            name: phrase.latin,
            description: phrase.english,
            inDefinedTermSet: {
              '@type': 'DefinedTermSet',
              name: "Caesar's De Bello Gallico Latin Phrases",
            },
          }),
        }}
      />
    </div>
  );
}
