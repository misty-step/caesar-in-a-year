import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllVocabWords, getVocabByWord, getRelatedVocab, getAllPhrases } from '@/lib/data/corpusPages';

interface PageProps {
  params: Promise<{ word: string }>;
}

export function generateStaticParams() {
  return getAllVocabWords().map((v) => ({ word: v.latinWord }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { word: rawWord } = await params;
  const word = decodeURIComponent(rawWord);
  const data = getVocabByWord(word);
  if (!data) return { title: 'Word Not Found' };

  const { vocab } = data;
  return {
    title: `${vocab.latinWord} — Latin Definition & Forms | Caesar in a Year`,
    description: `${vocab.latinWord}: ${vocab.meaning}. Learn this Latin word from Caesar's De Bello Gallico with example sentences and AI-powered practice.`,
  };
}

export default async function VocabPage({ params }: PageProps) {
  const { word: rawWord } = await params;
  const word = decodeURIComponent(rawWord);
  const data = getVocabByWord(word);
  if (!data) notFound();

  const { vocab, sentences } = data;
  const related = getRelatedVocab(word).slice(0, 8);

  // Parse chapter from source sentence ID
  const [, book, chapter] = vocab.sourceSentenceId.split('.');

  // Phrases from the same sentences
  const allPhrases = getAllPhrases();
  const sentenceIds = new Set(sentences.map((s) => s.id));
  const relatedPhrases = allPhrases
    .filter((p) => sentenceIds.has(p.sourceSentenceId))
    .slice(0, 6);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-text-muted">
        <Link href="/latin" className="hover:text-text-primary">
          Home
        </Link>
        <span className="mx-1">/</span>
        <Link href="/latin#vocabulary" className="hover:text-text-primary">
          Vocabulary
        </Link>
        <span className="mx-1">/</span>
        <span className="text-text-secondary">{vocab.latinWord}</span>
      </nav>

      {/* Header */}
      <h1 className="font-display text-3xl font-bold">{vocab.latinWord}</h1>
      <p className="mt-2 text-lg text-text-secondary">{vocab.meaning}</p>

      {/* Grammar info */}
      {vocab.questionType && (
        <section className="mt-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-eyebrow text-text-muted">
            Grammar
          </h2>
          <p className="mt-1 text-text-secondary">{vocab.question}</p>
          <p className="mt-1 font-medium">{vocab.answer}</p>
        </section>
      )}

      {/* Example sentences */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">
          Example Sentences from <em>De Bello Gallico</em>
        </h2>
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

      {/* Related phrases */}
      {relatedPhrases.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Related Phrases</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedPhrases.map((p) => (
              <Link
                key={p.slug}
                href={`/latin/phrase/${p.slug}`}
                className="rounded border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent"
              >
                <span className="font-serif">{p.latin}</span>
                <span className="ml-1.5 text-text-muted">{p.english}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Related vocab */}
      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">
            More Vocabulary from Book {book}, Chapter {chapter}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {related.map((v) => (
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
            name: vocab.latinWord,
            description: vocab.meaning,
            inDefinedTermSet: {
              '@type': 'DefinedTermSet',
              name: "Caesar's De Bello Gallico Latin Vocabulary",
            },
          }),
        }}
      />
    </div>
  );
}
