'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main className="min-h-dvh bg-background text-text-primary flex items-center justify-center">
          <div className="max-w-md mx-auto px-6 text-center space-y-4">
            <h1 className="text-3xl font-display tracking-tight">Application Error</h1>
            <p className="text-text-secondary">An unexpected error occurred.</p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-pill bg-accent text-accent-foreground px-5 py-2.5 font-medium hover:bg-accent-hover transition-colors"
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
