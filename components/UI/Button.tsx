import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/design';
import { LatinText } from './LatinText';

/**
 * Button variants using CVA (class-variance-authority)
 *
 * Deep module pattern: rich functionality, simple interface.
 * All Kinetic Codex aesthetics baked into base + variants.
 * Consumers just pick variant + size.
 */
const buttonVariants = cva(
  // Base styles - every button gets these
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium rounded-card',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    'transition-all duration-fast ease-ink',
    'active:scale-[0.98]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
  ],
  {
    variants: {
      variant: {
        // Primary - rubric red, the Kinetic Codex accent
        primary: 'bg-accent text-text-inverse hover:bg-accent-hover',
        // Secondary - surface with border
        secondary:
          'bg-surface text-text-primary border border-border hover:bg-surface-hover',
        // Outline - transparent with border
        outline:
          'bg-transparent text-text-secondary border border-border hover:bg-surface hover:text-text-primary',
        // Ghost - minimal, text only
        ghost: 'bg-transparent text-text-muted hover:text-text-primary hover:bg-surface',
        // Rubric - link-style with underline (signature Kinetic Codex)
        rubric:
          'bg-transparent text-accent underline decoration-accent/30 hover:decoration-accent hover:text-accent-hover',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-6 py-3 text-sm',
        lg: 'px-8 py-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * Show loading spinner
   */
  isLoading?: boolean;
  /**
   * Latin label for bilingual cycling
   */
  labelLatin?: string;
  /**
   * English label for bilingual cycling
   */
  labelEnglish?: string;
}

/**
 * Button component with Kinetic Codex styling
 *
 * @example
 * // Simple button
 * <Button variant="primary">Click me</Button>
 *
 * @example
 * // Bilingual button with Latin/English cycling
 * <Button labelLatin="Incipe" labelEnglish="Begin" />
 *
 * @example
 * // Rubric link-style
 * <Button variant="rubric">Learn more</Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant,
      size,
      isLoading,
      disabled,
      labelLatin,
      labelEnglish,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {labelLatin && labelEnglish ? (
          <LatinText latin={labelLatin} english={labelEnglish} interaction="cycle" />
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Export variants for composition
export { buttonVariants };
