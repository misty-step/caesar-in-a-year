import { PostHog } from 'posthog-node';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;

function createClient(apiKey: string): PostHog {
  return new PostHog(apiKey, {
    host: POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

export function getPostHogServer(): PostHog | null {
  if (!POSTHOG_API_KEY) return null;
  client ??= createClient(POSTHOG_API_KEY);
  return client;
}

export async function shutdownPostHog(): Promise<void> {
  if (!client) return;
  await client.shutdown();
  client = null;
}
