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
      {/* Decorative laurel border - subtle visual identity */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-laurel-500/30 to-transparent" />

      <div className="mx-auto max-w-4xl px-6 py-20 space-y-8 animate-fade-in">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-serif font-semibold leading-tight">
            Learn to read Caesar in 365 days.
          </h1>
          <p className="text-lg text-roman-700 max-w-2xl leading-relaxed">
            Short daily sessions that grade your translations with AI and build toward reading{' '}
            <span className="italic">De Bello Gallico</span> in the original Latin.
          </p>
        </div>

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
    </main>
  );
}
