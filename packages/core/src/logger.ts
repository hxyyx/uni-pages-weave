import pc from 'picocolors';

export type UpwLogLevel = 'info' | 'warn' | 'error';

export interface FormatLogOptions {
  colors?: boolean;
}

type LogColors = Pick<typeof pc, 'red' | 'yellow'>;

function colors(options: FormatLogOptions = {}): LogColors {
  return options.colors === undefined ? pc : pc.createColors(options.colors);
}

function label(level: UpwLogLevel, options?: FormatLogOptions): string {
  const value = level.toUpperCase();
  const color = colors(options);

  if (level === 'warn') {
    return color.yellow(value);
  }

  if (level === 'error') {
    return color.red(value);
  }

  return value;
}

export function formatLog(
  level: UpwLogLevel,
  message: string,
  options?: FormatLogOptions,
): string {
  return `[upw] ${label(level, options)}: ${message}`;
}

export const logger = {
  info(message: string): void {
    console.log(formatLog('info', message));
  },
  warn(message: string): void {
    console.warn(formatLog('warn', message));
  },
  error(message: string): void {
    console.error(formatLog('error', message));
  },
};


