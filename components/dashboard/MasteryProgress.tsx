import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';

const MASTERY_GOAL = 20;

interface MasteryProgressProps {
  masteredCount: number;
  readingLevel: number;
}

export function MasteryProgress({ masteredCount, readingLevel }: MasteryProgressProps) {
  const displayCount = Math.min(masteredCount, MASTERY_GOAL);
  const percentage = (displayCount / MASTERY_GOAL) * 100;
  const isMaxLevel = readingLevel >= 100;

  return (
    <section className="bg-parchment rounded-card border border-slate-200 p-6 space-y-4">
      <div className="space-y-1">
        <Label>
          <LatinText latin="Gradus Lectionis" english="Reading Level" />
        </Label>
        <p className="text-2xl font-serif text-ink">
          {readingLevel}/100
        </p>
      </div>

      {isMaxLevel ? (
        <p className="text-sm text-tyrian-600">
          <LatinText latin="Omnia patebunt!" english="All content unlocked!" />
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-ink-light">
            <span>
              <LatinText
                latin={`Perfectae: ${displayCount}/${MASTERY_GOAL}`}
                english={`Mastered: ${displayCount}/${MASTERY_GOAL}`}
              />
            </span>
            <span className="text-ink-muted">
              <LatinText latin="ad proximum gradum" english="to next level" />
            </span>
          </div>
          <div
            className="w-full bg-slate-200 h-2 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={displayCount}
            aria-valuemin={0}
            aria-valuemax={MASTERY_GOAL}
            aria-label="Progress toward next level"
          >
            <div
              className="bg-bronze-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-ink-muted">
            <LatinText
              latin="Viginti sententias perfice ut gradum augeas."
              english="Master 20 sentences to advance to the next level."
            />
          </p>
        </div>
      )}
    </section>
  );
}
