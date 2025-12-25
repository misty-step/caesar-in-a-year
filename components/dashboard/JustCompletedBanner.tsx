'use client';

import { useState } from 'react';
import { LatinText } from '@/components/UI/LatinText';

export function JustCompletedBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-r from-pompeii-600 to-pompeii-700 rounded-xl shadow-lg p-6 animate-bounce-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🎉</div>
          <div>
            <h2 className="text-xl font-serif font-semibold text-white">
              <LatinText latin="Bene fecisti!" english="Well done!" />
            </h2>
            <p className="text-sm text-pompeii-100">
              <LatinText
                latin="Sessionem hodie perfecisti."
                english="You completed today's session."
              />
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-pompeii-200 hover:text-white transition-colors text-2xl leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
