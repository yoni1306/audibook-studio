import { Controller, Get, Logger, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  @ApiOperation({ summary: 'Health check', description: 'Check the health status of the API service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    try {
      this.logger.log('🏥 [API] Health check requested');
      
      const healthData = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env['NODE_ENV'] || 'development',
        service: 'audibook-api',
      };
      
      this.logger.log('🏥 [API] Health check successful');
      return healthData;
    } catch (error) {
      this.logger.error(`💥 [API] Health check failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Health check failed',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
