import Link from 'next/link';

export default function LatinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-text-primary">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/latin" className="font-display text-lg font-semibold text-text-primary">
            Caesar in a Year
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Start Learning
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="border-t border-border-subtle">
        <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-text-muted">
          <div className="flex flex-wrap gap-4">
            <Link href="/latin" className="hover:text-text-primary">
              Home
            </Link>
            <Link href="/latin#books" className="hover:text-text-primary">
              Books
            </Link>
            <Link href="/latin#vocabulary" className="hover:text-text-primary">
              Vocabulary
            </Link>
            <Link href="/latin#phrases" className="hover:text-text-primary">
              Phrases
            </Link>
          </div>
          <p className="mt-3">
            Learn to read Caesar&apos;s <em>De Bello Gallico</em> with AI-powered translation practice.
          </p>
        </div>
      </footer>
    </div>
  );
}
