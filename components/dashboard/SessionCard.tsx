import Link from 'next/link';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';

interface SessionCardProps {
  justCompleted?: boolean;
}

/**
 * Session CTA card with primary action button.
 *
 * Uses Card component for surface + Button for the CTA.
 */
export function SessionCard({ justCompleted }: SessionCardProps) {
  return (
    <Card
      as="section"
      elevation="flat"
      padding="md"
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div className="space-y-1">
        <Label>
          Session
        </Label>
        <h2 className="text-xl font-serif font-semibold text-text-primary">
          {justCompleted ? (
            <LatinText latin="Hodie perfecisti!" english="You finished today!" />
          ) : (
            <LatinText latin="Paratus es ad lectionem?" english="Ready for today's guided reading?" />
          )}
        </h2>
        <p className="text-sm text-text-secondary">
          {justCompleted ? (
            <LatinText
              latin="Iterum exercere potes, si vis."
              english="You can practice again if you'd like."
            />
          ) : (
            <LatinText
              latin="Sententias recognosces, deinde breviorem locum cum glossario leges."
              english="You'll review key sentences, then tackle a short passage with glossary support."
            />
          )}
        </p>
      </div>
      <div className="flex justify-end">
        <Link href="/session/new">
          <Button
            className="w-full sm:w-auto text-base px-8 py-3"
            labelLatin={justCompleted ? 'Iterum Exercere' : 'Incipe Sessionem'}
            labelEnglish={justCompleted ? 'Practice Again' : 'Start Session'}
          />
        </Link>
      </div>
    </Card>
  );
}
