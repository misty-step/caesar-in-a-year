import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/design';

/**
 * Card variants using CVA
 *
 * Deep module: surface container with elevation + padding variants.
 * All Kinetic Codex aesthetics (warm surface, subtle borders) baked in.
 */
const cardVariants = cva(
  // Base styles
  ['rounded-card', 'transition-all duration-fast ease-ink'],
  {
    variants: {
      elevation: {
        // Flat - minimal, just background
        flat: 'bg-surface',
        // Raised - standard card with border and shadow
        raised: 'bg-surface border border-border shadow-card',
        // Interactive - hover lift effect
        interactive:
          'bg-surface border border-border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer',
        // Outlined - border only, no shadow
        outlined: 'bg-transparent border border-border',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      elevation: 'raised',
      padding: 'md',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /**
   * Render as a different element (e.g., 'section', 'article')
   */
  as?: React.ElementType;
}

/**
 * Card component - surface container with Kinetic Codex styling
 *
 * @example
 * // Standard card
 * <Card>Content here</Card>
 *
 * @example
 * // Interactive card (hover effect)
 * <Card elevation="interactive" onClick={handleClick}>
 *   Clickable content
 * </Card>
 *
 * @example
 * // Compact card
 * <Card padding="sm" elevation="flat">
 *   Minimal content
 * </Card>
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation, padding, as: Component = 'div', children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ elevation, padding }), className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';

// Export variants for composition
export { cardVariants };
