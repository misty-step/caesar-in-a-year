import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import type { JourneyProgress as JourneyProgressType } from '@/lib/data/types';

interface JourneyProgressProps {
  iter: JourneyProgressType;
}

export function JourneyProgress({ iter }: JourneyProgressProps) {
  const { sentencesEncountered, totalSentences, percentComplete } = iter;

  return (
    <section className="bg-parchment rounded-card border border-slate-200 p-6 space-y-4">
      <div className="flex justify-between items-baseline">
        <Label>
          <LatinText latin="Iter per Caesarem" english="Journey through Caesar" />
        </Label>
        <p className="text-lg font-serif text-tyrian-500">
          {percentComplete}%
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="w-full bg-slate-100 h-3 rounded-card overflow-hidden"
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress through De Bello Gallico"
      >
        <div
          className="bg-gradient-to-r from-tyrian-400 to-tyrian-600 h-full transition-all duration-500 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-ink-muted">
        <span>
          <LatinText
            latin={`${sentencesEncountered} sententiae visae`}
            english={`${sentencesEncountered} sentences seen`}
          />
        </span>
        <span>
          <LatinText
            latin={`ex ${totalSentences} totalis`}
            english={`of ${totalSentences} total`}
          />
        </span>
      </div>
    </section>
  );
}
