import { Controller, Post, Body, Logger, InternalServerErrorException } from '@nestjs/common';

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
    try {
      this.logger.log('📝 [API] Receiving client logs');
      
      const { logs } = body;
      
      if (!logs || !Array.isArray(logs)) {
        this.logger.warn('📝 [API] Invalid logs format received');
        return { 
          success: false, 
          message: 'Invalid logs format',
          timestamp: new Date().toISOString(),
        };
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

      this.logger.log(`📝 [API] Successfully processed ${logs.length} client logs`);
      
      return { 
        success: true, 
        count: logs.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error processing client logs: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to process client logs',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
