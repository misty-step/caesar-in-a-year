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
    <main className="min-h-screen bg-roman-50 text-roman-900">
      <div className="mx-auto max-w-4xl px-6 py-20 space-y-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-roman-500 font-semibold">
            Caesar in a Year
          </p>
          <h1 className="text-4xl sm:text-5xl font-serif font-semibold">
            Learn to read Caesar in 365 days.
          </h1>
          <p className="text-lg text-roman-700 max-w-2xl">
            Short daily sessions that grade your translations with Gemini and build toward reading{' '}
            <span className="italic">De Bello Gallico</span> in the original Latin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link href="/sign-in" className="inline-flex">
            <button className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pompeii-600 hover:bg-pompeii-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pompeii-500">
              Sign in to start
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
