'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';
import React from 'react';

import { ToastProvider } from '@/components/UI/Toast';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: React.ReactNode }) {
  if (!convex) {
    // During static builds, return children without Convex provider
    return (
      <ClerkProvider>
        <ToastProvider>{children}</ToastProvider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ToastProvider>{children}</ToastProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
