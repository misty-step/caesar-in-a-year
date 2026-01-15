import Link from 'next/link';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Button } from '@/components/UI/Button';
import { Card } from '@/components/UI/Card';
import type { Session } from '@/lib/data/types';

interface SummaryCardProps {
  session: Session;
}

/**
 * Laurel wreath icon for celebration moments.
 * Uses semantic celebration color.
 */
function LaurelIcon() {
  return (
    <svg className="size-16 text-celebration" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
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

/**
 * Session completion summary.
 *
 * Uses semantic tokens:
 * - Card component for surface styling
 * - text-celebration for success highlights
 * - text-text-primary/muted for hierarchy
 */
export function SummaryCard({ session }: SummaryCardProps) {
  const totalItems = session.items.length;
  // Estimate XP: 10 per item (simplified)
  const estimatedXP = totalItems * 10;

  return (
    <Card as="section" elevation="flat" padding="lg" className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Celebration header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <LaurelIcon />
        <div className="space-y-1">
          <Label>
            <LatinText latin="Summarium Sessionis" english="Session Summary" />
          </Label>
          <h1 className="text-3xl font-serif text-text-primary">
            <LatinText latin="Bene fecisti!" english="Well done!" />
          </h1>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-center gap-8 py-4 border-y border-border">
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{totalItems}</p>
          <p className="text-xs text-text-muted">
            <LatinText latin="Segmenta" english="Segments" />
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-celebration">+{estimatedXP}</p>
          <p className="text-xs text-text-muted">XP</p>
        </div>
      </div>

      <p className="text-sm text-text-secondary text-center text-pretty">
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
    </Card>
  );
}
