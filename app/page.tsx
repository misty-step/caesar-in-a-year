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
    <main className="min-h-screen bg-roman-50 text-roman-900 relative overflow-hidden">
      {/* Decorative laurel borders - subtle visual identity */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-laurel-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-laurel-500/20 to-transparent" />

      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20 space-y-12 animate-fade-in">
        {/* Hero section */}
        <div className="space-y-6">
          <h1 className="text-4xl sm:text-5xl font-serif font-semibold leading-tight">
            Learn to read Caesar in 365 days.
          </h1>
          <p className="text-lg text-roman-700 max-w-2xl leading-relaxed">
            Short daily sessions that grade your translations with AI and build toward reading{' '}
            <span className="italic">De Bello Gallico</span> in the original Latin.
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/sign-in" className="inline-flex group">
              <button className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-sm font-medium rounded-lg text-white bg-pompeii-600 hover:bg-pompeii-500 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pompeii-500 transition-all duration-200">
                Begin your journey
                <svg className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </Link>
            <p className="text-sm text-roman-500">
              No drills. Just guided reading, one passage at a time.
            </p>
          </div>
        </div>

        {/* Sample passage preview */}
        <div className="space-y-4">
          <p className="text-xs font-semibold tracking-eyebrow text-roman-500 uppercase">
            Day 1 Preview
          </p>
          <blockquote className="bg-marble rounded-xl border border-roman-200 p-6 space-y-3">
            <p className="font-serif text-xl text-roman-900 leading-relaxed">
              Gallia est omnis divisa in partes tres.
            </p>
            <p className="text-roman-600 text-sm">
              &ldquo;All Gaul is divided into three parts.&rdquo;
            </p>
            <cite className="text-xs text-roman-400 block">
              — Caesar, <span className="italic">De Bello Gallico</span> I.1
            </cite>
          </blockquote>
        </div>

        {/* Method preview */}
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-laurel-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-laurel-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="font-semibold text-roman-900">Read</h3>
            <p className="text-sm text-roman-600">New passages each day with interactive glossary</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-terracotta-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-terracotta-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="font-semibold text-roman-900">Translate</h3>
            <p className="text-sm text-roman-600">Write your understanding, graded by AI tutor</p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-pompeii-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-pompeii-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-roman-900">Master</h3>
            <p className="text-sm text-roman-600">Spaced review builds lasting comprehension</p>
          </div>
        </div>
      </div>
    </main>
  );
}
