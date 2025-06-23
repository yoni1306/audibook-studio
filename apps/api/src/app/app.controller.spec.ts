import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should return the default API welcome payload', () => {
    expect(controller.getData()).toEqual({
      message: 'Welcome to Audibook Studio API',
      version: '0.1.0',
      docs: '/api/health for health check',
      timestamp: expect.any(String),
    });
  });
});
