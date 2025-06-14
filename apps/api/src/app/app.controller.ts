import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getData() {
    return {
      message: 'Welcome to Audibook Studio API',
      version: '0.1.0',
      docs: '/api/health for health check',
    };
  }
}