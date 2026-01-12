'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/design';

interface LatinTextProps {
  latin: string;
  english: string;
  className?: string;
  /**
   * 'inline': standard span behavior
   * 'block': div behavior
   */
  variant?: 'inline' | 'block';
  /**
   * 'tooltip': Hover/Click to reveal (Good for static text)
   * 'cycle': Automatically cross-fades between Latin and English (Good for Buttons on mobile)
   */
  interaction?: 'tooltip' | 'cycle';
  /**
   * Use inverted colors for dark backgrounds
   */
  inverted?: boolean;
}

/**
 * Dual-language text component with tooltip or cycle modes.
 *
 * Uses semantic tokens:
 * - border-border / border-accent for underline
 * - bg-text-primary for tooltip background (inverts naturally)
 * - text-text-inverse for tooltip text
 * - Inverted mode swaps colors for dark surfaces
 */
export const LatinText: React.FC<LatinTextProps> = ({
  latin,
  english,
  className = '',
  variant = 'inline',
  interaction = 'tooltip',
  inverted = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [cycleShowEnglish, setCycleShowEnglish] = useState(false);

  useEffect(() => {
    if (interaction !== 'cycle') return;

    const interval = setInterval(() => {
      if (!isHovered) {
        setCycleShowEnglish((prev) => !prev);
      }
    }, cycleShowEnglish ? 3000 : 6000);

    return () => clearInterval(interval);
  }, [interaction, cycleShowEnglish, isHovered]);

  const Tag = variant === 'block' ? 'div' : 'span';

  if (interaction === 'cycle') {
    const showEnglish = isHovered || cycleShowEnglish;

    return (
      <Tag
        className={cn('relative inline-flex items-center justify-center', className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        <span className="invisible select-none font-bold" aria-hidden="true" title={latin}>
          {latin.length > english.length ? latin : english}
        </span>

        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-opacity duration-slow ease-ink',
            showEnglish ? 'opacity-0' : 'opacity-100'
          )}
        >
          {latin}
        </span>

        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center transition-opacity duration-slow ease-ink',
            showEnglish ? 'opacity-100' : 'opacity-0'
          )}
        >
          {english}
        </span>
      </Tag>
    );
  }

  return (
    <Tag
      className={cn('relative cursor-help group inline-block', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsHovered(!isHovered);
      }}
    >
      <span
        className={cn(
          'transition-all duration-normal border-b border-dotted',
          inverted
            ? 'border-white/30 group-hover:border-white/80'
            : 'border-border group-hover:border-accent'
        )}
      >
        {latin}
      </span>

      <span
        className={cn(
          'absolute left-1/2 -translate-x-1/2 bottom-full mb-2',
          'px-3 py-1.5 text-xs font-sans rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none',
          'transition-all duration-normal ease-ink origin-bottom',
          inverted
            ? 'bg-surface text-text-primary'
            : 'bg-text-primary text-text-inverse',
          isHovered
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2'
        )}
        style={{ maxWidth: '200px', whiteSpace: 'normal', textAlign: 'center', width: 'max-content' }}
      >
        {english}
        <span
          className={cn(
            'absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent',
            inverted ? 'border-t-surface' : 'border-t-text-primary'
          )}
        />
      </span>
    </Tag>
  );
};
