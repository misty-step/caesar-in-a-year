import { LatinText } from '@/components/UI/LatinText';

export function Hero() {
  return (
    <section className="space-y-4 text-center sm:text-left animate-fade-in">
      <p className="text-xs uppercase tracking-eyebrow text-roman-500 font-semibold">
        Caesar in a Year
      </p>
      <h1 className="text-4xl sm:text-5xl font-serif font-semibold text-roman-900">
        <LatinText
          latin="Ad Bellum Gallicum, passu cottidiano."
          english="Toward the Gallic War, one day at a time."
          variant="block"
        />
      </h1>
      <p className="text-lg text-roman-700 max-w-2xl">
        Short, focused sessions that train you to read Latin in context, not just memorize forms.
      </p>
    </section>
  );
}
