import { LatinText } from '@/components/UI/LatinText';
import type { XPProgress } from '@/lib/data/types';

interface XPDisplayProps {
  xp: XPProgress;
}

export function XPDisplay({ xp }: XPDisplayProps) {
  const { total, level, currentLevelXp, toNextLevel } = xp;
  const levelProgress = toNextLevel > 0
    ? (currentLevelXp / (currentLevelXp + toNextLevel)) * 100
    : 100;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-roman-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-roman-500">
            <LatinText latin="Gradus" english="Level" />
          </p>
          <p className="text-3xl font-serif text-roman-900">{level}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-roman-500">
            <LatinText latin="Puncta Totalia" english="Total XP" />
          </p>
          <p className="text-lg font-medium text-pompeii-600">{total.toLocaleString()}</p>
        </div>
      </div>

      {/* XP progress to next level */}
      <div className="space-y-1">
        <div
          className="w-full bg-roman-100 h-2 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={currentLevelXp}
          aria-valuemin={0}
          aria-valuemax={currentLevelXp + toNextLevel}
          aria-label="Progress to next level"
        >
          <div
            className="bg-pompeii-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
        <p className="text-[10px] text-roman-400 text-right">
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
    </section>
  );
}
