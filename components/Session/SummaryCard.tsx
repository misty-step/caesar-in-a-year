import Link from 'next/link';
import { LatinText } from '@/components/UI/LatinText';
import { Button } from '@/components/UI/Button';
import type { Session } from '@/lib/data/types';

interface SummaryCardProps {
  session: Session;
}

// Simple laurel wreath SVG for celebration
function LaurelIcon() {
  return (
    <svg className="w-16 h-16 text-laurel-500" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Left branch */}
      <path d="M32 56V32" />
      <path d="M32 32c-4-6-12-8-16-6 4-4 12-2 16 6z" />
      <path d="M32 38c-4-6-14-7-18-4 4-5 14-2 18 4z" />
      <path d="M32 44c-4-5-15-5-19-2 4-5 15-3 19 2z" />
      <path d="M32 50c-3-4-12-4-16-1 3-5 13-3 16 1z" />
      {/* Right branch */}
      <path d="M32 32c4-6 12-8 16-6-4-4-12-2-16 6z" />
      <path d="M32 38c4-6 14-7 18-4-4-5-14-2-18 4z" />
      <path d="M32 44c4-5 15-5 19-2-4-5-15-3-19 2z" />
      <path d="M32 50c3-4 12-4 16-1-3-5-13-3-16 1z" />
    </svg>
  );
}

export function SummaryCard({ session }: SummaryCardProps) {
  const totalItems = session.items.length;
  // Estimate XP: 10 per item (simplified)
  const estimatedXP = totalItems * 10;

  return (
    <section className="max-w-2xl mx-auto bg-marble rounded-xl border border-roman-200 p-8 space-y-6 animate-fade-in">
      {/* Celebration header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <LaurelIcon />
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-eyebrow text-roman-500">
            <LatinText latin="Summarium Sessionis" english="Session Summary" />
          </span>
          <h1 className="text-3xl font-serif text-roman-900">
            <LatinText latin="Bene fecisti!" english="Well done!" />
          </h1>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-center gap-8 py-4 border-y border-roman-200">
        <div className="text-center">
          <p className="text-2xl font-bold text-roman-900">{totalItems}</p>
          <p className="text-xs text-roman-500">
            <LatinText latin="Segmenta" english="Segments" />
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-laurel-600">+{estimatedXP}</p>
          <p className="text-xs text-roman-500">XP</p>
        </div>
      </div>

      <p className="text-sm text-roman-600 text-center">
        <LatinText
          latin="Crastinus dies iterum novam lectionem afferet."
          english="Tomorrow brings another small step toward reading Caesar in the original."
        />
      </p>

      <div className="flex justify-center">
        <Link href="/dashboard">
          <Button labelLatin="Ad Tabulam" labelEnglish="To Dashboard" />
        </Link>
      </div>
    </section>
  );
}
