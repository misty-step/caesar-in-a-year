import { LatinText } from '@/components/UI/LatinText';
import type { JourneyProgress as JourneyProgressType } from '@/lib/data/types';

interface JourneyProgressProps {
  iter: JourneyProgressType;
}

export function JourneyProgress({ iter }: JourneyProgressProps) {
  const { sentencesEncountered, totalSentences, percentComplete } = iter;

  return (
    <section className="bg-white rounded-xl shadow-sm border border-roman-200 p-6 space-y-4">
      <div className="flex justify-between items-baseline">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-roman-500">
          <LatinText latin="Iter per Caesarem" english="Journey through Caesar" />
        </p>
        <p className="text-lg font-serif text-pompeii-600">
          {percentComplete}%
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="w-full bg-roman-100 h-3 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress through De Bello Gallico"
      >
        <div
          className="bg-gradient-to-r from-pompeii-400 to-pompeii-600 h-full transition-all duration-500 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-roman-500">
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
