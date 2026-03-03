'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/UI/Button';

export default function SummaryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-background text-text-primary flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center space-y-4">
        <h1 className="text-2xl font-serif">Summary unavailable</h1>
        <p className="text-text-secondary text-sm">We hit an unexpected issue while loading your session recap.</p>
        <Button onClick={reset} labelLatin="Iterum Tempta" labelEnglish="Try Again" />
      </div>
    </main>
  );
}
