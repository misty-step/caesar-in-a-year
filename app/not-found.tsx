import Link from 'next/link';
import { LatinText } from '@/components/UI/LatinText';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-9xl font-serif font-black text-slate-200 tracking-tighter select-none">
            CDIV
          </h1>
          <div className="-mt-12 relative z-10">
            <h2 className="text-3xl font-serif font-bold text-ink tracking-tight">
              Iter perdidisti?
            </h2>
            <p className="mt-2 text-sm text-ink-muted uppercase tracking-eyebrow font-semibold">
              Page Not Found
            </p>
          </div>
        </div>

        <div className="bg-parchment p-6 rounded-card border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-tyrian-500 to-tyrian-600"></div>
          <p className="text-ink-light mb-6 leading-relaxed">
            "Mehercule! It seems the road you are looking for has not yet been paved by the legions. It may have been lost to time, or perhaps never existed at all."
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-card text-white bg-tyrian-600 hover:bg-tyrian-500 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tyrian-500 transition-all duration-200"
            >
              Return to Rome (Home)
            </Link>
            <Link
              href="/dashboard"
              className="w-full inline-flex justify-center items-center px-4 py-3 border border-slate-300 text-sm font-medium rounded-card text-ink-light bg-parchment hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>

        <div className="text-ink-faint text-xs italic">
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
