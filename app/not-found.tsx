import Link from 'next/link';
import { LatinText } from '@/components/UI/LatinText';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-9xl font-serif font-black text-surface tracking-tighter select-none">
            CDIV
          </h1>
          <div className="-mt-12 relative z-10">
            <h2 className="text-3xl font-serif font-bold text-text-primary tracking-tight">
              Iter perdidisti?
            </h2>
            <p className="mt-2 text-sm text-text-muted uppercase tracking-eyebrow font-semibold">
              Page Not Found
            </p>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-card border border-border relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent-hover"></div>
          <p className="text-text-secondary mb-6 leading-relaxed">
            "Mehercule! It seems the road you are looking for has not yet been paved by the legions. It may have been lost to time, or perhaps never existed at all."
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-card text-white bg-accent hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-all duration-fast ease-ink"
            >
              Return to Rome (Home)
            </Link>
            <Link
              href="/dashboard"
              className="w-full inline-flex justify-center items-center px-4 py-3 border border-border text-sm font-medium rounded-card text-text-secondary bg-background hover:bg-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-border transition-all duration-fast ease-ink"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>

        <div className="text-text-faint text-xs italic">
          <LatinText
            latin="Errare humanum est."
            english="To err is human."
            interaction="tooltip"
          />
        </div>
      </div>
    </div>
  );
}
