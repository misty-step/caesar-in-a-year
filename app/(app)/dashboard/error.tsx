'use client';

import { useEffect } from 'react';
import { Button } from '@/components/UI/Button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-parchment text-ink flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-card bg-terracotta-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-terracotta-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-serif text-ink">Something went wrong</h1>
          <p className="text-ink-muted text-sm">
            We encountered an error loading your dashboard. This has been logged and we&apos;ll look into it.
          </p>
        </div>

        <Button onClick={reset} labelLatin="Iterum Tempta" labelEnglish="Try Again" />
      </div>
    </main>
  );
}
