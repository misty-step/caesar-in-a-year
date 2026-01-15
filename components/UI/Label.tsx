import React from 'react';
import { cn } from '@/lib/design';

interface LabelProps {
  children: React.ReactNode;
  className?: string;
  as?: 'p' | 'span' | 'div';
}

/**
 * Eyebrow label component - consistent section headers
 * Used for category labels, section titles, and metadata
 *
 * Uses semantic token: text-text-muted
 */
export const Label: React.FC<LabelProps> = ({
  children,
  className,
  as: Tag = 'p',
}) => {
  return (
    <Tag
      className={cn(
        'text-xs font-semibold uppercase tracking-eyebrow text-text-muted',
        className
      )}
    >
      {children}
    </Tag>
  );
};
