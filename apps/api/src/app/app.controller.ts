import { Controller, Get, Logger, InternalServerErrorException } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  @Get()
  @ApiOperation({ summary: 'API information', description: 'Get basic information about the Audibook Studio API' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved API information' })
  getData() {
    try {
      this.logger.log('🏠 [API] Root endpoint accessed');
      
      return {
        message: 'Welcome to Audibook Studio API',
        version: '0.1.0',
        docs: '/api/health for health check',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`💥 [API] Error in root endpoint: ${error.message}`, error.stack);
      throw new InternalServerErrorException({
        error: 'Internal Server Error',
        message: 'Failed to get API information',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
