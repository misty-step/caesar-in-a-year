'use client';

import type { ReactNode } from 'react';
import { Toaster, toast } from 'sonner';

/**
 * Toast provider with Kinetic Codex styling
 *
 * Uses semantic tokens for consistent appearance:
 * - Surface background
 * - Border color
 * - Text primary
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: 'font-serif bg-surface border border-border text-text-primary shadow-card',
          },
        }}
      />
    </>
  );
}

export function showToast(message: string) {
  toast.success(message, {
    duration: 4000,
  });
}
