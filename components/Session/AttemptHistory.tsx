'use client';

import React, { useState } from 'react';
import type { AttemptHistoryEntry } from '@/lib/data/types';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';

interface AttemptHistoryProps {
  history: AttemptHistoryEntry[];
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'CORRECT':
      return 'bg-laurel-500';
    case 'PARTIAL':
      return 'bg-terracotta-500';
    case 'INCORRECT':
      return 'bg-iron-500';
    default:
      return 'bg-slate-400';
  }
}

function getStatusLabel(status: string): { latin: string; english: string } {
  switch (status) {
    case 'CORRECT':
      return { latin: 'Recte', english: 'Correct' };
    case 'PARTIAL':
      return { latin: 'Partim', english: 'Partial' };
    case 'INCORRECT':
      return { latin: 'Non', english: 'Incorrect' };
    default:
      return { latin: '?', english: 'Unknown' };
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const AttemptHistory: React.FC<AttemptHistoryProps> = ({ history }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!history || history.length === 0) {
    return null;
  }

  const attemptCount = history.length;

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <Label as="span">
          <LatinText latin="Historiae Tuae" english="Your History" />
        </Label>
        <span className="flex items-center gap-2 text-sm text-ink-light">
          <span className="font-medium">
            {attemptCount} {attemptCount === 1 ? 'attempt' : 'attempts'}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {history.map((attempt, index) => {
            const label = getStatusLabel(attempt.gradingStatus);
            return (
              <div
                key={`${attempt.sentenceId}-${attempt.createdAt}`}
                className="flex items-center gap-3 p-2 rounded-card bg-slate-50 border border-slate-100"
              >
                {/* Attempt number */}
                <span className="text-xs font-bold text-ink-faint w-6 text-center">
                  #{history.length - index}
                </span>

                {/* Status badge */}
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-page text-xs font-medium text-white ${getStatusColor(attempt.gradingStatus)}`}
                >
                  <LatinText latin={label.latin} english={label.english} />
                </span>

                {/* Date */}
                <span className="text-xs text-ink-muted">{formatDate(attempt.createdAt)}</span>

                {/* Error types (if any) */}
                {attempt.errorTypes.length > 0 && (
                  <span className="text-xs text-ink-faint flex-1 truncate">
                    {attempt.errorTypes.slice(0, 2).join(', ')}
                    {attempt.errorTypes.length > 2 && ` +${attempt.errorTypes.length - 2}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
