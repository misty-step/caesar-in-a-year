'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/design';

export interface RubricTermProps {
  /**
   * The Latin term to display
   */
  latin: string;
  /**
   * English translation (shown on hover/tap)
   */
  english: string;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Callback when term is clicked
   */
  onClick?: () => void;
}

/**
 * RubricTerm - Kinetic Codex signature interaction
 *
 * Latin vocabulary terms that exhibit "fluid rubrication":
 * - Rubric red color (manuscript accent)
 * - Subtle scale on hover
 * - Ink-flow underline animation
 * - Tooltip with English translation
 *
 * @example
 * <RubricTerm latin="Gallia" english="Gaul" />
 *
 * @example
 * // With click handler for vocabulary drill
 * <RubricTerm
 *   latin="divisa"
 *   english="divided"
 *   onClick={() => selectWord('divisa')}
 * />
 */
export function RubricTerm({ latin, english, className, onClick }: RubricTermProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span
      className={cn(
        // Base rubric styling
        'rubric-term',
        // Additional positioning for tooltip
        'relative inline-block',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {latin}

      {/* Tooltip */}
      <span
        className={cn(
          'absolute left-1/2 -translate-x-1/2 -top-8',
          'px-2 py-1 rounded-card',
          'bg-text-primary text-text-inverse text-xs whitespace-nowrap',
          'shadow-card',
          'transition-all duration-fast ease-ink',
          'pointer-events-none',
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
        )}
        role="tooltip"
        aria-hidden={!isHovered}
      >
        {english}
        {/* Tooltip arrow */}
        <span
          className={cn(
            'absolute left-1/2 -translate-x-1/2 -bottom-1',
            'w-2 h-2 rotate-45',
            'bg-text-primary'
          )}
        />
      </span>
    </span>
  );
}

/**
 * RubricTermGroup - Container for connected rubric terms
 *
 * When multiple terms in a phrase should highlight together,
 * wrap them in a group. Hovering any term highlights all.
 *
 * @example
 * <RubricTermGroup>
 *   <RubricTerm latin="in" english="into" />
 *   <RubricTerm latin="partes" english="parts" />
 *   <RubricTerm latin="tres" english="three" />
 * </RubricTermGroup>
 */
export function RubricTermGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'group inline-flex gap-1',
        // All terms in group highlight together
        '[&_.rubric-term]:group-hover:scale-[1.02]',
        '[&_.rubric-term::after]:group-hover:w-full',
        className
      )}
    >
      {children}
    </span>
  );
}
