type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

const isDevelopment = process.env.NODE_ENV === 'development';

function serialize(level: LogLevel, message: string, fields?: LogFields): string {
  return JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  });
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
  if (level === 'debug' && !isDevelopment) return;

  const logMethods: Record<LogLevel, (...args: unknown[]) => void> = {
    debug: console.debug,
    info: console.log,
    warn: console.warn,
    error: console.error,
  };

  if (isDevelopment) {
    logMethods[level](message, fields ?? {});
    return;
  }

  const line = serialize(level, message, fields);
  logMethods[level](line);
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    write('debug', message, fields);
  },
  info(message: string, fields?: LogFields): void {
    write('info', message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    write('warn', message, fields);
  },
  error(message: string, fields?: LogFields): void {
    write('error', message, fields);
  },
};

function normalizeError(error: unknown): { message: string; fields: LogFields } {
  if (error instanceof Error) {
    return {
      message: error.message,
      fields: {
        errorName: error.name,
        stack: error.stack,
      },
    };
  }

  const message = String(error);
  return { message, fields: { error: message } };
}

export function logError(error: unknown, fields: LogFields = {}): void {
  const normalized = normalizeError(error);
  logger.error(normalized.message, { ...fields, ...normalized.fields });
}
