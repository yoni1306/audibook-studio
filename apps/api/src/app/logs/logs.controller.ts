import { Controller, Post, Body, Logger } from '@nestjs/common';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: string;
  data?: unknown;
}

@Controller('logs')
export class LogsController {
  private readonly logger = new Logger('ClientLogs');

  @Post()
  async receiveLogs(@Body() body: { logs: LogEntry[] }) {
    const { logs } = body;
    
    if (!logs || !Array.isArray(logs)) {
      return { success: false, message: 'Invalid logs format' };
    }

    // Process each log entry and forward to NestJS logger
    // NestJS logger will handle sending to Loki if configured
    logs.forEach(log => {
      const message = `[CLIENT] [${log.context}] ${log.message}`;
      
      switch (log.level) {
        case 'debug':
          this.logger.debug(message, log.data);
          break;
        case 'info':
          this.logger.log(message, log.data);
          break;
        case 'warn':
          this.logger.warn(message, log.data);
          break;
        case 'error':
          this.logger.error(message, log.data);
          break;
        default:
          this.logger.log(message, log.data);
      }
    });

    return { success: true, count: logs.length };
  }
}
