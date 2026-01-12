import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import { cn } from '@/lib/design';
import type { LegionTiers } from '@/lib/data/types';

interface LegionStatusProps {
  legion: LegionTiers;
}

const TIERS = [
  { key: 'tirones' as const, label: 'Tirones', sublabel: 'Recruits', color: 'bg-border' },
  { key: 'milites' as const, label: 'Milites', sublabel: 'Soldiers', color: 'bg-success' },
  { key: 'veterani' as const, label: 'Veterani', sublabel: 'Veterans', color: 'bg-warning' },
  { key: 'decuriones' as const, label: 'Decuriones', sublabel: 'Officers', color: 'bg-accent' },
];

/**
 * Legion status showing sentence mastery tiers.
 *
 * Uses semantic status colors for tier indicators.
 */
export function LegionStatus({ legion }: LegionStatusProps) {
  const total = legion.tirones + legion.milites + legion.veterani + legion.decuriones;

  if (total === 0) {
    return (
      <Card as="section" elevation="flat" padding="md" className="space-y-4">
        <div className="space-y-1">
          <Label>
            <LatinText latin="Legio Tua" english="Your Legion" />
          </Label>
          <p className="text-sm text-text-secondary">
            <LatinText
              latin="Nulla sententiae adhuc. Incipe sessionem!"
              english="No sentences yet. Start a session!"
            />
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card as="section" elevation="flat" padding="md" className="space-y-4">
      <div className="flex justify-between items-baseline">
        <Label>
          <LatinText latin="Legio Tua" english="Your Legion" />
        </Label>
        <p className="text-sm text-text-secondary">
          {total} <span className="text-xs"><LatinText latin="sententiae" english="sentences" /></span>
        </p>
      </div>

      {/* Stacked bar */}
      <div className="h-6 rounded-lg overflow-hidden flex bg-border">
        {TIERS.map(({ key, color }) => {
          const count = legion[key];
          if (count === 0) return null;
          const width = (count / total) * 100;
          return (
            <div
              key={key}
              className={cn(color, 'transition-all duration-slow')}
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
            <div className={cn('size-3 rounded-sm', color)} />
            <span className="text-text-secondary font-medium">{label}</span>
            <span className="text-text-faint text-[10px]">({sublabel})</span>
            <span className="text-text-muted ml-auto tabular-nums">{legion[key]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
