export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  private log(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] [${this.prefix}] ${message}`;
    if (level === 'ERROR') {
      console.error(formatted, ...args);
    } else if (level === 'WARN') {
      console.warn(formatted, ...args);
    } else if (level === 'DEBUG') {
      if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
        console.debug(formatted, ...args);
      }
    } else {
      console.log(formatted, ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    this.log('DEBUG', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log('INFO', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('WARN', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log('ERROR', message, ...args);
  }
}
