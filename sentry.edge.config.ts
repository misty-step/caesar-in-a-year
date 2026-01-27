import * as Sentry from '@sentry/nextjs';
import { sentryBaseOptions } from '@/lib/sentry/base';

Sentry.init(sentryBaseOptions);
