import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import { ProgressBar } from '@/components/UI/ProgressBar';
import type { JourneyProgress as JourneyProgressType } from '@/lib/data/types';

interface JourneyProgressProps {
  iter: JourneyProgressType;
}

/**
 * Journey progress card showing overall completion through De Bello Gallico.
 *
 * Uses Card for surface, ProgressBar for visual progress.
 */
export function JourneyProgress({ iter }: JourneyProgressProps) {
  const { sentencesEncountered, totalSentences, percentComplete } = iter;

  return (
    <Card as="section" elevation="flat" padding="md" className="space-y-4">
      <div className="flex justify-between items-baseline">
        <Label>
          <LatinText latin="Iter per Caesarem" english="Journey through Caesar" />
        </Label>
        <p className="text-lg font-serif text-accent">
          {percentComplete}%
        </p>
      </div>

      <ProgressBar
        current={percentComplete}
        total={100}
        color="gradient"
        ariaLabel="Progress through De Bello Gallico"
        className="h-3"
      />

      <div className="flex justify-between text-xs text-text-muted">
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
    </Card>
  );
}
