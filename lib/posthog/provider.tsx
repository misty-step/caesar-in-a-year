'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { initPostHog, isPostHogReady, posthog } from './client';

function buildUrl(pathname: string): string {
  return `${window.origin}${pathname}`;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const [ready, setReady] = useState(isPostHogReady);

  useEffect(() => {
    setReady(initPostHog(() => setReady(true)));
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (isSignedIn && user) {
      posthog.identify(user.id);
      return;
    }
    posthog.reset();
  }, [isSignedIn, ready, user]);

  useEffect(() => {
    if (!ready || !pathname) return;
    posthog.capture('$pageview', { $current_url: buildUrl(pathname) });
  }, [pathname, ready]);

  return <>{children}</>;
}
