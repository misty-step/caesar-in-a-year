import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest';

let started = false;
let ready = false;

function getKey(): string | null {
  if (typeof window === 'undefined') return null;
  if (!POSTHOG_KEY) return null;
  return POSTHOG_KEY;
}

export function isPostHogReady(): boolean {
  return ready;
}

export function initPostHog(onReady?: () => void): boolean {
  const key = getKey();
  if (!key) return false;
  if (started) {
    if (ready) onReady?.();
    return ready;
  }

  started = true;

  posthog.init(key, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
    },
    loaded: () => {
      ready = true;
      if (process.env.NODE_ENV === 'development') {
        posthog.opt_out_capturing();
      }
      onReady?.();
    },
  });

  return ready;
}

export { posthog };
