'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { initPostHog, isPostHogReady, posthog } from './client';

function buildUrl(pathname: string, searchParams: ReturnType<typeof useSearchParams>): string {
  const params = searchParams?.toString();
  if (!params) return `${window.origin}${pathname}`;
  return `${window.origin}${pathname}?${params}`;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isSignedIn } = useUser();
  const [ready, setReady] = useState(isPostHogReady);

  useEffect(() => {
    setReady(initPostHog(() => setReady(true)));
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (isSignedIn && user) {
      posthog.identify(user.id, {
        createdAt: user.createdAt,
      });
      return;
    }
    posthog.reset();
  }, [isSignedIn, ready, user]);

  useEffect(() => {
    if (!ready || !pathname) return;
    posthog.capture('$pageview', { $current_url: buildUrl(pathname, searchParams) });
  }, [pathname, ready, searchParams]);

  return <>{children}</>;
}
