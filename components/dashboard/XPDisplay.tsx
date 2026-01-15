import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import { ProgressBar } from '@/components/UI/ProgressBar';
import type { XPProgress } from '@/lib/data/types';

interface XPDisplayProps {
  xp: XPProgress;
}

/**
 * XP and level display with progress to next level.
 *
 * Uses Card for surface, ProgressBar with achievement color.
 */
export function XPDisplay({ xp }: XPDisplayProps) {
  const { total, level, currentLevelXp, toNextLevel } = xp;

  return (
    <Card as="section" elevation="flat" padding="md" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>
            <LatinText latin="Gradus" english="Level" />
          </Label>
          <p className="text-3xl font-serif text-text-primary">{level}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">
            <LatinText latin="Puncta Totalia" english="Total XP" />
          </p>
          <p className="text-lg font-medium text-achievement tabular-nums">{total.toLocaleString()}</p>
        </div>
      </div>

      {/* XP progress to next level */}
      <div className="space-y-1">
        <ProgressBar
          current={currentLevelXp}
          total={currentLevelXp + toNextLevel}
          color="achievement"
          ariaLabel="Progress to next level"
        />
        <p className="text-xs text-text-faint text-right">
          {toNextLevel > 0 ? (
            <LatinText
              latin={`${toNextLevel} ad proximum`}
              english={`${toNextLevel} XP to level ${level + 1}`}
            />
          ) : (
            <LatinText latin="Maximum!" english="Max level!" />
          )}
        </p>
      </div>
    </Card>
  );
}
