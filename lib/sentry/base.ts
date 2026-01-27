const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NODE_ENV;

export const sentryBaseOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment,
  tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
};

