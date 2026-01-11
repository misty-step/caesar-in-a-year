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
            toast: 'font-serif bg-slate-50 border border-slate-200 text-ink',
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
