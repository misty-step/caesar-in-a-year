'use client';

import { useState } from 'react';
import { LatinText } from '@/components/UI/LatinText';

export function JustCompletedBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="animate-bounce-in bg-verdigris-50 border border-verdigris-200 rounded-card p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Laurel wreath icon - electric celebration */}
        <div className="w-8 h-8 rounded-card bg-verdigris-100 flex items-center justify-center animate-stamp">
          <svg className="w-5 h-5 text-verdigris-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 3c-1.5 2-2 4-2 6s.5 4 2 6c1.5-2 2-4 2-6s-.5-4-2-6z" />
            <path d="M6 6c1 2 3 3 5 3M18 6c-1 2-3 3-5 3" />
            <path d="M4 10c1.5 1.5 3.5 2 6 2M20 10c-1.5 1.5-3.5 2-6 2" />
            <path d="M3 15c2 1 4.5 1.5 7 1M21 15c-2 1-4.5 1.5-7 1" />
            <path d="M5 19c2 .5 4.5.5 7 0M19 19c-2 .5-4.5.5-7 0" />
          </svg>
        </div>
        <div>
          <p className="font-serif text-ink font-medium">
            <LatinText latin="Bene fecisti!" english="Well done!" />
          </p>
          <p className="text-xs text-ink-muted">
            <LatinText
              latin="Sessionem hodie perfecisti."
              english="You completed today's session."
            />
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-ink-muted hover:text-ink transition-colors p-1"
        aria-label="Dismiss"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
