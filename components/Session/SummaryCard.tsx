import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import type { AttemptSummary, Session } from '@/lib/data/types';
import { XP_PER_ITEM } from '@/lib/progress/xp';

interface SummaryCardProps {
  session: Session;
  attemptSummary: AttemptSummary;
  streak: number;
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
export function SummaryCard({ session, attemptSummary, streak }: SummaryCardProps) {
  const totalItems = session.items.length;
  const xpEarned = totalItems * XP_PER_ITEM;

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
      <div className="flex justify-center gap-8 py-4 border-y border-border" role="group" aria-label="Session statistics">
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{totalItems}</p>
          <p className="text-xs text-text-muted">
            <LatinText latin="Segmenta" english="Segments" />
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-celebration">+{xpEarned}</p>
          <p className="text-xs text-text-muted">XP</p>
        </div>
        {streak > 0 && (
          <div className="text-center">
            <p className="text-2xl font-bold text-achievement">
              {streak}
            </p>
            <p className="text-xs text-text-muted">
              <LatinText latin="Dies" english="Day streak" />
            </p>
          </div>
        )}
      </div>

      {/* Accuracy breakdown */}
      {attemptSummary.total > 0 && (
        <div className="flex justify-center gap-6 py-3" role="group" aria-label="Accuracy breakdown">
          {[
            { icon: '\u2713', count: attemptSummary.correct, color: 'text-success', latin: 'Recte', english: 'Correct' },
            { icon: '~', count: attemptSummary.partial, color: 'text-warning', latin: 'Partim', english: 'Partial' },
            { icon: '\u2717', count: attemptSummary.incorrect, color: 'text-text-muted', latin: 'Falsum', english: 'Incorrect' },
          ].map(({ icon, count, color, latin, english }) => (
            <div key={english} className="flex items-center gap-1.5">
              <span className={`${color} text-lg`} aria-hidden="true">{icon}</span>
              <span className="text-sm font-medium text-text-primary">{count}</span>
              <span className="text-xs text-text-muted">
                <LatinText latin={latin} english={english} />
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-text-secondary text-center text-pretty">
        <LatinText
          latin="Crastinus dies iterum novam lectionem afferet."
          english="Tomorrow brings another small step toward reading Caesar in the original."
        />
      </p>
    </Card>
  );
}
