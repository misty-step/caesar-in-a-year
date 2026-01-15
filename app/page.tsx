import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-dvh bg-background text-text-primary relative">
      {/* Subtle paper texture */}
      <div className="absolute inset-0 bg-paper pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-20 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display text-lg tracking-tight text-text-primary hover:text-accent transition-colors">
            Caesar<span className="text-accent">.</span>
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6">
        {/* Hero Section */}
        <section className="pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <p className="label mb-6 animate-fade-in">
              Latin · Daily Practice
            </p>

            {/* Headline */}
            <h1 className="font-display text-display-md md:text-display-lg lg:text-display-xl mb-6 animate-fade-in-up text-balance">
              Read Caesar
              <br />
              <span className="text-accent">in one year.</span>
            </h1>

            {/* Subhead */}
            <p className="text-lg md:text-xl text-text-secondary max-w-lg leading-relaxed mb-8 animate-fade-in-delay text-pretty">
              Daily sessions with AI-graded translations. Start from zero,
              finish reading <em className="font-serif text-text-primary">De Bello Gallico</em> in the original.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap items-center gap-4 animate-fade-in-delay-2">
              <Link href="/sign-in">
                <button className="group inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-accent rounded-card transition-all duration-fast ease-ink hover:bg-accent-hover hover:shadow-glow-accent active:scale-[0.98]">
                  Start reading
                  <svg className="size-4 ml-2 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </Link>
              <span className="text-sm text-text-muted">
                Free to start
              </span>
            </div>
          </div>
        </section>

        {/* Quote */}
        <section className="py-12 border-t border-border animate-fade-in-delay-2">
          <blockquote className="max-w-xl">
            <p className="font-serif text-2xl md:text-3xl text-text-primary italic leading-relaxed mb-4">
              "Gallia est omnis divisa in partes tres."
            </p>
            <footer className="flex items-center gap-3">
              <div className="w-8 h-px bg-border" />
              <div>
                <p className="text-sm text-text-muted mb-0.5">"All Gaul is divided into three parts."</p>
                <cite className="text-xs text-text-faint not-italic">Caesar, De Bello Gallico I.1</cite>
              </div>
            </footer>
          </blockquote>
        </section>

        {/* Method Section */}
        <section className="py-16 border-t border-border">
          <p className="label mb-8">The Method</p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Read */}
            <div className="group">
              <div className="size-10 rounded-card bg-surface flex items-center justify-center text-text-muted mb-4 group-hover:bg-accent-faint group-hover:text-accent transition-colors">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-medium text-text-primary mb-1">Read</h3>
              <p className="text-sm text-text-muted leading-relaxed">New passages daily with interactive glossary support.</p>
            </div>

            {/* Translate */}
            <div className="group">
              <div className="size-10 rounded-card bg-surface flex items-center justify-center text-text-muted mb-4 group-hover:bg-accent-faint group-hover:text-accent transition-colors">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <h3 className="font-medium text-text-primary mb-1">Translate</h3>
              <p className="text-sm text-text-muted leading-relaxed">Write your understanding. AI grades instantly.</p>
            </div>

            {/* Review */}
            <div className="group">
              <div className="size-10 rounded-card bg-surface flex items-center justify-center text-text-muted mb-4 group-hover:bg-accent-faint group-hover:text-accent transition-colors">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <h3 className="font-medium text-text-primary mb-1">Review</h3>
              <p className="text-sm text-text-muted leading-relaxed">Spaced repetition locks in comprehension.</p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 border-t border-border">
          <div className="flex flex-wrap justify-start items-baseline gap-12 md:gap-16">
            <div>
              <div className="font-display text-4xl text-text-primary tracking-tight tabular-nums">365</div>
              <div className="label mt-1">lessons</div>
            </div>
            <div>
              <div className="font-display text-4xl text-text-primary tracking-tight tabular-nums">7</div>
              <div className="label mt-1">books</div>
            </div>
            <div>
              <div className="font-display text-4xl text-accent tracking-tight tabular-nums">1</div>
              <div className="label mt-1 text-accent/70">year</div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-28 border-t border-border">
          <h2 className="font-serif text-2xl md:text-3xl text-text-primary mb-3 italic text-balance">
            Read the original.
          </h2>
          <p className="text-text-muted text-sm mb-8 max-w-sm leading-relaxed text-pretty">
            Join those learning to read ancient texts in their original language.
          </p>
          <Link href="/sign-in">
            <button className="group inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-text-primary rounded-card transition-all duration-fast ease-ink hover:bg-text-secondary active:scale-[0.98]">
              Start for free
              <svg className="size-4 ml-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </Link>
        </section>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8">
        <div className="max-w-4xl mx-auto px-6 text-sm text-text-muted">
          © 2025 Caesar in a Year
        </div>
      </footer>
    </main>
  );
}
