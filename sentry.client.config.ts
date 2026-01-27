import * as Sentry from '@sentry/nextjs';
import { sentryBaseOptions } from '@/lib/sentry/base';

const isProduction = process.env.NODE_ENV === 'production';

Sentry.init({
  ...sentryBaseOptions,
  replaysSessionSampleRate: isProduction ? 0.1 : 0,
  replaysOnErrorSampleRate: isProduction ? 1.0 : 0,
  beforeSend(event) {
    if (!event.user) return event;
    delete event.user.email;
    delete event.user.ip_address;
    return event;
  },
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
