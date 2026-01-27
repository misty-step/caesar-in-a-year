'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { initPostHog, posthog } from './client';

export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!posthog.__loaded) return;

    if (isSignedIn && user) {
      posthog.identify(user.id, {
        createdAt: user.createdAt,
      });
    } else {
      posthog.reset();
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    if (!posthog.__loaded) return;
    if (!pathname) return;

    let url = window.origin + pathname;
    if (searchParams?.toString()) {
      url = `${url}?${searchParams.toString()}`;
    }

    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
