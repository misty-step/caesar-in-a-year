import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/design';

/**
 * ProgressBar variants using CVA
 *
 * Deep module: progress indicator with color variants for different contexts.
 * Motion: ink-flow animation on initial render.
 */
const progressBarVariants = cva(
  // Base fill styles
  'h-full transition-all duration-slow ease-ink',
  {
    variants: {
      color: {
        // Default accent (rubric red)
        accent: 'bg-accent',
        // Success (laurel green)
        success: 'bg-success',
        // Achievement (bronze gold)
        achievement: 'bg-achievement',
        // Celebration (verdigris)
        celebration: 'bg-celebration',
        // Gradient variant
        gradient: 'bg-gradient-to-r from-accent-light to-accent',
      },
    },
    defaultVariants: {
      color: 'accent',
    },
  }
);

export interface ProgressBarProps extends VariantProps<typeof progressBarVariants> {
  current: number;
  total: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Accessible label */
  ariaLabel?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  color,
  showLabel = false,
  ariaLabel = 'Progress',
  className,
}) => {
  const percentage = Math.min(Math.round((current / total) * 100), 100);

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-text-muted">
          <span>
            {current} / {total}
          </span>
          <span>{percentage}%</span>
        </div>
      )}
      <div
        className="w-full bg-border h-2 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <div
          className={cn(progressBarVariants({ color }))}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Export variants for composition
export { progressBarVariants };
