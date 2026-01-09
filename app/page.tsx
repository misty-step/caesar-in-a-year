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
    <main className="min-h-screen bg-obsidian text-white relative overflow-hidden">
      {/* Aurora gradient background */}
      <div className="absolute inset-0 bg-mesh-gradient" />
      <div className="absolute inset-0 bg-aurora" />
      <div className="absolute inset-0 bg-aurora-gold" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      {/* Nav */}
      <nav className="relative z-20 border-b border-slate-700/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display text-base tracking-tight text-white hover:text-slate-200 transition-colors">
            Caesar<span className="text-crimson-500">.</span>
          </Link>
          <Link
            href="/sign-in"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Hero Section */}
        <section className="pt-16 pb-12 md:pt-24 md:pb-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-6">
              {/* Eyebrow */}
              <div className="animate-fade-in">
                <span className="inline-flex items-center gap-3 text-xs font-medium tracking-eyebrow text-bronze-400 uppercase">
                  <span className="w-8 h-px bg-bronze-500/60" />
                  Classical Latin
                </span>
              </div>

              {/* Headline */}
              <h1 className="font-display text-display-md md:text-display-lg lg:text-display-xl animate-fade-in-up">
                Read Caesar
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-crimson-400 via-crimson-500 to-bronze-400">
                  in 365 days.
                </span>
              </h1>

              {/* Subhead - brighter */}
              <p className="text-lg md:text-xl text-slate-300 max-w-lg leading-relaxed animate-fade-in-delay">
                Daily sessions with AI-graded translations. Start from zero,
                finish reading <em className="text-white font-serif">De Bello Gallico</em> in the original.
              </p>

              {/* CTA */}
              <div className="flex flex-wrap items-center gap-4 pt-2 animate-fade-in-delay-2">
                <Link href="/sign-in">
                  <button className="group inline-flex items-center justify-center px-6 py-3.5 text-sm font-semibold text-white bg-crimson-500 rounded-lg transition-all duration-200 hover:bg-crimson-600 hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]">
                    Begin your conquest
                    <svg className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </Link>
                <span className="text-sm text-slate-500">
                  Free forever
                </span>
              </div>
            </div>

            {/* Right: Quote card */}
            <div className="animate-fade-in-delay-2">
              <div className="relative group">
                {/* Glow */}
                <div className="absolute -inset-px bg-gradient-to-r from-imperial-500/20 via-bronze-500/10 to-crimson-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <blockquote className="relative bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 md:p-8">
                  <p className="font-serif text-xl md:text-2xl text-white italic leading-relaxed mb-4">
                    "Gallia est omnis divisa in partes tres."
                  </p>
                  <footer className="flex items-center gap-3">
                    <div className="w-8 h-px bg-gradient-to-r from-bronze-500 to-transparent" />
                    <div className="text-sm">
                      <p className="text-slate-300">"All Gaul is divided into three parts."</p>
                      <cite className="text-slate-500 not-italic">— Caesar, I.1</cite>
                    </div>
                  </footer>
                </blockquote>
              </div>
            </div>
          </div>
        </section>

        {/* Method Section */}
        <section className="py-14 md:py-16 border-t border-slate-800/40">
          <div className="text-center mb-10">
            <h2 className="font-display text-xl md:text-2xl text-white mb-2">The Method</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">Three steps, repeated daily, for lasting mastery.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Read */}
            <div className="group p-6 rounded-xl border border-slate-800/50 bg-slate-900/30 hover:bg-slate-800/30 hover:border-slate-700/50 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-imperial-500/10 flex items-center justify-center text-imperial-400 mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-display text-lg text-white mb-1.5">Read</h3>
              <p className="text-slate-400 text-sm leading-relaxed">New passages daily with interactive glossary.</p>
            </div>

            {/* Translate */}
            <div className="group p-6 rounded-xl border border-slate-800/50 bg-slate-900/30 hover:bg-slate-800/30 hover:border-slate-700/50 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-crimson-500/10 flex items-center justify-center text-crimson-400 mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <h3 className="font-display text-lg text-white mb-1.5">Translate</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Write your understanding. AI grades instantly.</p>
            </div>

            {/* Master */}
            <div className="group p-6 rounded-xl border border-slate-800/50 bg-slate-900/30 hover:bg-slate-800/30 hover:border-slate-700/50 transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-bronze-500/10 flex items-center justify-center text-bronze-400 mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <h3 className="font-display text-lg text-white mb-1.5">Master</h3>
              <p className="text-slate-400 text-sm leading-relaxed">Spaced repetition for lasting comprehension.</p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-10 md:py-12 border-t border-slate-800/40">
          <div className="flex flex-wrap justify-center items-end gap-16 md:gap-24">
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl text-white tracking-tight">365</div>
              <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">lessons</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl text-white tracking-tight">7</div>
              <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">books</div>
            </div>
            <div className="text-center">
              <div className="font-display text-4xl md:text-5xl text-bronze-400 tracking-tight">∞</div>
              <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">glory</div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-20 text-center border-t border-slate-800/40">
          <h2 className="font-display text-2xl md:text-3xl text-white mb-3">
            Veni. Vidi. <span className="text-crimson-400">Legi.</span>
          </h2>
          <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
            Join those learning to read ancient texts in their original language.
          </p>
          <Link href="/sign-in">
            <button className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-obsidian bg-white rounded-lg hover:bg-slate-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
              Start for free
            </button>
          </Link>
        </section>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/50 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-slate-600">
          <span>© 2025 Caesar in a Year</span>
          <span className="font-serif italic">"Alea iacta est."</span>
        </div>
      </footer>
    </main>
  );
}
