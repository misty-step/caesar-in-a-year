'use client';

import type { ReactNode } from 'react';
import { Toaster, toast } from 'sonner';

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: 'font-serif bg-roman-50 border border-roman-200 text-roman-900',
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
