import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import { ProgressBar } from '@/components/UI/ProgressBar';

const MASTERY_GOAL = 20;

interface MasteryProgressProps {
  masteredCount: number;
  readingLevel: number;
}

/**
 * Reading level and mastery progress toward next level.
 *
 * Uses Card for surface, ProgressBar with achievement color.
 */
export function MasteryProgress({ masteredCount, readingLevel }: MasteryProgressProps) {
  const displayCount = Math.min(masteredCount, MASTERY_GOAL);
  const isMaxLevel = readingLevel >= 100;

  return (
    <Card as="section" elevation="flat" padding="md" className="space-y-4">
      <div className="space-y-1">
        <Label>
          <LatinText latin="Gradus Lectionis" english="Reading Level" />
        </Label>
        <p className="text-2xl font-serif text-text-primary">
          {readingLevel}/100
        </p>
      </div>

      {isMaxLevel ? (
        <p className="text-sm text-accent">
          <LatinText latin="Omnia patebunt!" english="All content unlocked!" />
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-text-secondary">
            <span>
              <LatinText
                latin={`Perfectae: ${displayCount}/${MASTERY_GOAL}`}
                english={`Mastered: ${displayCount}/${MASTERY_GOAL}`}
              />
            </span>
            <span className="text-text-muted">
              <LatinText latin="ad proximum gradum" english="to next level" />
            </span>
          </div>
          <ProgressBar
            current={displayCount}
            total={MASTERY_GOAL}
            color="achievement"
            ariaLabel="Progress toward next level"
          />
          <p className="text-xs text-text-muted">
            <LatinText
              latin="Viginti sententias perfice ut gradum augeas."
              english="Master 20 sentences to advance to the next level."
            />
          </p>
        </div>
      )}
    </Card>
  );
}
