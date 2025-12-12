'use client';

import { Toaster, toast } from 'sonner';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'font-serif',
          style: {
            background: '#faf8f5', // roman-50
            border: '1px solid #e5e0d8', // roman-200
            color: '#3d3730', // roman-900
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
