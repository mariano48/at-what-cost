type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  correlationId?: string;
  [key: string]: unknown;
}

function write(level: LogLevel, scope: string, message: string, context?: LogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) => write('debug', scope, message, context),
    info: (message: string, context?: LogContext) => write('info', scope, message, context),
    warn: (message: string, context?: LogContext) => write('warn', scope, message, context),
    error: (message: string, context?: LogContext) => write('error', scope, message, context),
  };
}

export type Logger = ReturnType<typeof createLogger>;
