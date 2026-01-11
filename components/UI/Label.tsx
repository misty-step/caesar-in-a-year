import React from 'react';

interface LabelProps {
  children: React.ReactNode;
  className?: string;
  as?: 'p' | 'span' | 'div';
}

/**
 * Eyebrow label component - consistent section headers
 * Used for category labels, section titles, and metadata
 */
export const Label: React.FC<LabelProps> = ({
  children,
  className = '',
  as: Tag = 'p',
}) => {
  return (
    <Tag className={`text-xs font-semibold uppercase tracking-eyebrow text-ink-muted ${className}`}>
      {children}
    </Tag>
  );
};
