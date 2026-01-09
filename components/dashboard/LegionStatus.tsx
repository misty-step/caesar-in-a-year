import { LatinText } from '@/components/UI/LatinText';
import type { LegionTiers } from '@/lib/data/types';

interface LegionStatusProps {
  legion: LegionTiers;
}

const TIERS = [
  { key: 'tirones' as const, label: 'Tirones', sublabel: 'Recruits', color: 'bg-roman-300' },
  { key: 'milites' as const, label: 'Milites', sublabel: 'Soldiers', color: 'bg-laurel-500' },
  { key: 'veterani' as const, label: 'Veterani', sublabel: 'Veterans', color: 'bg-terracotta-500' },
  { key: 'decuriones' as const, label: 'Decuriones', sublabel: 'Officers', color: 'bg-tyrian-500' },
];

export function LegionStatus({ legion }: LegionStatusProps) {
  const total = legion.tirones + legion.milites + legion.veterani + legion.decuriones;

  if (total === 0) {
    return (
      <section className="bg-marble rounded-xl border border-roman-200 p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-roman-500">
            <LatinText latin="Legio Tua" english="Your Legion" />
          </p>
          <p className="text-sm text-roman-600">
            <LatinText
              latin="Nulla sententiae adhuc. Incipe sessionem!"
              english="No sentences yet. Start a session!"
            />
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-marble rounded-xl border border-roman-200 p-6 space-y-4">
      <div className="flex justify-between items-baseline">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-roman-500">
          <LatinText latin="Legio Tua" english="Your Legion" />
        </p>
        <p className="text-sm text-roman-600">
          {total} <span className="text-xs"><LatinText latin="sententiae" english="sentences" /></span>
        </p>
      </div>

      {/* Stacked bar */}
      <div className="h-6 rounded-full overflow-hidden flex bg-roman-100">
        {TIERS.map(({ key, color }) => {
          const count = legion[key];
          if (count === 0) return null;
          const width = (count / total) * 100;
          return (
            <div
              key={key}
              className={`${color} transition-all duration-500`}
              style={{ width: `${width}%` }}
              title={`${count} ${key}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {TIERS.map(({ key, label, sublabel, color }) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-sm ${color}`} />
            <span className="text-roman-700 font-medium">{label}</span>
            <span className="text-roman-400 text-[10px]">({sublabel})</span>
            <span className="text-roman-500 ml-auto tabular-nums">{legion[key]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
