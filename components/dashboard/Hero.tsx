import Link from 'next/link';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';

/**
 * Dashboard hero section with tagline.
 *
 * Uses semantic tokens:
 * - text-text-primary for heading
 * - text-text-secondary for description
 */
export function Hero() {
  return (
    <section className="space-y-4 text-center sm:text-left animate-fade-in">
      <div className="flex items-center justify-between">
        <Label>
          Caesar in a Year
        </Label>
        <Link
          href="/settings"
          className="text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          Settings
        </Link>
      </div>
      <h1 className="text-4xl sm:text-5xl font-serif font-semibold text-text-primary">
        <LatinText
          latin="Ad Bellum Gallicum, passu cottidiano."
          english="Toward the Gallic War, one day at a time."
          variant="block"
        />
      </h1>
      <p className="text-lg text-text-secondary max-w-2xl">
        Short, focused sessions that train you to read Latin in context, not just memorize forms.
      </p>
    </section>
  );
}
