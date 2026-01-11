import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';

export function Hero() {
  return (
    <section className="space-y-4 text-center sm:text-left animate-fade-in">
      <Label>
        Caesar in a Year
      </Label>
      <h1 className="text-4xl sm:text-5xl font-serif font-semibold text-ink">
        <LatinText
          latin="Ad Bellum Gallicum, passu cottidiano."
          english="Toward the Gallic War, one day at a time."
          variant="block"
        />
      </h1>
      <p className="text-lg text-ink-light max-w-2xl">
        Short, focused sessions that train you to read Latin in context, not just memorize forms.
      </p>
    </section>
  );
}
