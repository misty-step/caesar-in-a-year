import React from 'react';
import type { ErrorType } from '@/lib/data/types';

interface ErrorTypeIconProps {
  type: ErrorType;
  className?: string;
}

// SVG icons for each error type - thematic Roman/scholarly style
const icons: Record<ErrorType, React.ReactNode> = {
  // Grammar: Column/pillar (structure)
  grammar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="8" y="4" width="8" height="2" />
      <rect x="8" y="18" width="8" height="2" />
      <line x1="10" y1="6" x2="10" y2="18" />
      <line x1="14" y1="6" x2="14" y2="18" />
    </svg>
  ),
  // Vocabulary: Scroll/book (learning)
  vocabulary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  // Word order: Arrows/swap (rearrangement)
  word_order: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M7 16l-4-4 4-4" />
      <path d="M17 8l4 4-4 4" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  ),
  // Omission: Gap/missing piece
  omission: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="12" x2="8" y2="12" />
      <line x1="16" y1="12" x2="20" y2="12" />
      <circle cx="12" cy="12" r="2" strokeDasharray="2 2" />
    </svg>
  ),
  // Comprehension: Head/mind
  comprehension: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="10" r="6" />
      <path d="M12 16v4" />
      <path d="M8 20h8" />
      <circle cx="10" cy="9" r="1" fill="currentColor" />
      <circle cx="14" cy="9" r="1" fill="currentColor" />
    </svg>
  ),
  // Misreading: Eye with X
  misreading: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  ),
  // Other: Question mark
  other: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 9a3 3 0 1 1 6 0c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  ),
};

const labels: Record<ErrorType, string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  word_order: 'Word Order',
  omission: 'Omission',
  comprehension: 'Comprehension',
  misreading: 'Misreading',
  other: 'Other',
};

export const ErrorTypeIcon: React.FC<ErrorTypeIconProps> = ({ type, className = 'w-4 h-4' }) => {
  return (
    <span className={className} title={labels[type]} aria-label={labels[type]}>
      {icons[type]}
    </span>
  );
};

export const getErrorTypeLabel = (type: ErrorType): string => labels[type];
