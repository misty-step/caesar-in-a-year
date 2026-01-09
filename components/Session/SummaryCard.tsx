import { LatinText } from '@/components/UI/LatinText';
import type { Session } from '@/lib/data/types';

interface SummaryCardProps {
  session: Session;
}

export function SummaryCard({ session }: SummaryCardProps) {
  const totalItems = session.items.length;

  return (
    <section className="max-w-2xl mx-auto bg-marble rounded-xl border border-roman-200 p-8 space-y-4 animate-fade-in">
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-eyebrow text-roman-500">
          <LatinText latin="Summarium Sessionis" english="Session Summary" />
        </span>
        <h1 className="text-3xl font-serif text-roman-900">
          <LatinText latin="Bene fecisti." english="Well done." />
        </h1>
      </div>

      <p className="text-sm text-roman-700">
        <LatinText
          latin={`Perfecisti sessionem cum ${totalItems} segmentis.`}
          english={`You completed this session with ${totalItems} segments.`}
        />
      </p>

      <p className="text-xs text-roman-500">
        <LatinText
          latin="Crastinus dies iterum novam lectionem afferet."
          english="Tomorrow brings another small step toward reading Caesar in the original."
        />
      </p>
    </section>
  );
}
