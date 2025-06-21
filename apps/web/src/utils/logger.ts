/**
 * Client-side logger that can send logs to the backend for Loki integration
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: string;
  data?: unknown;
}

class ClientLogger {
  private context: string;
  private batchedLogs: LogEntry[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly batchSize = 10;
  private readonly batchTimeMs = 5000; // 5 seconds
  
  constructor(context: string) {
    this.context = context;
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
    console.debug(`[${this.context}] ${message}`, data || '');
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
    console.info(`[${this.context}] ${message}`, data || '');
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
    console.warn(`[${this.context}] ${message}`, data || '');
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
    console.error(`[${this.context}] ${message}`, data || '');
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data: data ? this.sanitizeData(data) : undefined
    };

    this.batchedLogs.push(logEntry);
    
    if (this.batchedLogs.length >= this.batchSize) {
      this.sendLogs();
    } else if (!this.batchTimeout) {
      // Set a timeout to send logs even if we don't reach batch size
      this.batchTimeout = setTimeout(() => this.sendLogs(), this.batchTimeMs);
    }
  }

  private sanitizeData(data: unknown): Record<string, unknown> {
    // Prevent circular references and limit data size
    try {
      const jsonStr = JSON.stringify(data);
      return jsonStr.length > 10000 ? { truncated: true, message: 'Data too large' } : JSON.parse(jsonStr);
    } catch {
      // Ignore specific error - just return a generic message
      return { error: 'Failed to serialize data' };
    }
  }

  private async sendLogs(): void {
    if (this.batchedLogs.length === 0) return;
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const logs = [...this.batchedLogs];
    this.batchedLogs = [];

    try {
      await fetch('http://localhost:3333/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      });
    } catch (error) {
      console.error('Failed to send logs to server:', error);
      // If sending fails, we could add them back to the batch
      // But we don't want to create an infinite loop of failed logs
    }
  }

  // Call this when the component unmounts to ensure logs are sent
  flush(): void {
    if (this.batchedLogs.length > 0) {
      this.sendLogs();
    }
  }
}

// Factory function to create loggers with different contexts
export function createLogger(context: string): ClientLogger {
  return new ClientLogger(context);
}
