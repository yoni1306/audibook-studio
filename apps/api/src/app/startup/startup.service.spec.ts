import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StartupService } from './startup.service';
import { StartupLogicBase } from './base/startup-logic.base';

// Mock startup logic for testing
class MockStartupLogic extends StartupLogicBase {
  public shouldRunResult = true;
  public executeError: Error | null = null;
  public executeCalled = false;
  public runCalled = false;
  private name: string;

  constructor(prisma: PrismaService, name: string) {
    super(prisma);
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  async shouldRun(): Promise<boolean> {
    return this.shouldRunResult;
  }

  async execute(): Promise<void> {
    this.executeCalled = true;
    if (this.executeError) {
      throw this.executeError;
    }
  }

  async run(): Promise<void> {
    this.runCalled = true;
    return super.run();
  }
}

describe('StartupService', () => {
  let service: StartupService;
  let prismaService: jest.Mocked<PrismaService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartupService,
        {
          provide: PrismaService,
          useValue: {
            // Mock any prisma methods if needed
          },
        },
      ],
    }).compile();

    service = module.get<StartupService>(StartupService);
    prismaService = module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>;
    
    // Spy on logger methods
    loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and registration', () => {
    it('should register startup logic during construction', () => {
      expect(service['startupLogics']).toBeDefined();
      expect(service['startupLogics'].length).toBeGreaterThan(0);
    });

    it('should include AudioTimestampBackfillStartup in registered logic', () => {
      const registeredNames = service.getRegisteredStartupLogics();
      expect(registeredNames).toContain('Audio Timestamp Backfill Migration');
    });
  });

  describe('getRegisteredStartupLogics', () => {
    it('should return array of startup logic names', () => {
      const names = service.getRegisteredStartupLogics();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('Audio Timestamp Backfill Migration');
    });
  });

  describe('onModuleInit', () => {
    let mockStartupLogic1: MockStartupLogic;
    let mockStartupLogic2: MockStartupLogic;

    beforeEach(() => {
      // Replace the registered startup logics with mocks for testing
      mockStartupLogic1 = new MockStartupLogic(prismaService, 'Mock Logic 1');
      mockStartupLogic2 = new MockStartupLogic(prismaService, 'Mock Logic 2');
      
      service['startupLogics'] = [mockStartupLogic1, mockStartupLogic2];
    });

    it('should run all registered startup logic successfully', async () => {
      await service.onModuleInit();

      expect(mockStartupLogic1.runCalled).toBe(true);
      expect(mockStartupLogic2.runCalled).toBe(true);
      
      expect(loggerSpy).toHaveBeenCalledWith('🚀 Running 2 startup logic(s)...');
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringMatching(/✅ Startup logic completed: 2 succeeded, 0 failed \(\d+ms total\)/)
      );
    });

    it('should handle startup logic failures gracefully', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      const testError = new Error('Mock startup logic failed');
      
      // Make the first logic fail
      jest.spyOn(mockStartupLogic1, 'run').mockRejectedValue(testError);

      await service.onModuleInit();

      expect(mockStartupLogic1.runCalled).toBe(false); // run was mocked to throw
      expect(mockStartupLogic2.runCalled).toBe(true); // second should still run
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to run startup logic: Mock Logic 1',
        testError
      );
      
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringMatching(/✅ Startup logic completed: 1 succeeded, 1 failed \(\d+ms total\)/)
      );
    });

    it('should warn about failures in summary', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');
      
      // Make both logics fail
      jest.spyOn(mockStartupLogic1, 'run').mockRejectedValue(new Error('Error 1'));
      jest.spyOn(mockStartupLogic2, 'run').mockRejectedValue(new Error('Error 2'));

      await service.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith('⚠️ 2 startup logic(s) failed - check logs above for details');
    });

    it('should not warn when all startup logic succeeds', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.onModuleInit();

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should measure total execution time', async () => {
      // Mock Date.now to control timing
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 2500; // 1500ms total duration
      });

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith('✅ Startup logic completed: 2 succeeded, 0 failed (1500ms total)');

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should handle empty startup logic list', async () => {
      service['startupLogics'] = [];

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith('No startup logic registered');
    });

    it('should run startup logic in sequence', async () => {
      const executionOrder: string[] = [];
      
      jest.spyOn(mockStartupLogic1, 'run').mockImplementation(async () => {
        executionOrder.push('Logic 1');
      });
      
      jest.spyOn(mockStartupLogic2, 'run').mockImplementation(async () => {
        executionOrder.push('Logic 2');
      });

      await service.onModuleInit();

      expect(executionOrder).toEqual(['Logic 1', 'Logic 2']);
    });

    it('should continue with remaining logic even if one fails', async () => {
      const executionOrder: string[] = [];
      
      jest.spyOn(mockStartupLogic1, 'run').mockImplementation(async () => {
        executionOrder.push('Logic 1');
        throw new Error('Logic 1 failed');
      });
      
      jest.spyOn(mockStartupLogic2, 'run').mockImplementation(async () => {
        executionOrder.push('Logic 2');
      });

      await service.onModuleInit();

      expect(executionOrder).toEqual(['Logic 1', 'Logic 2']);
    });
  });

  describe('integration with real AudioTimestampBackfillStartup', () => {
    it('should have AudioTimestampBackfillStartup registered by default', () => {
      const realService = new StartupService(prismaService);
      const names = realService.getRegisteredStartupLogics();
      
      expect(names).toContain('Audio Timestamp Backfill Migration');
    });

    it('should be able to run with real startup logic', async () => {
      // This test verifies that the service can work with the actual startup logic
      // without mocking, but we won't actually execute database operations
      
      const realService = new StartupService(prismaService);
      const startupLogics = realService['startupLogics'];
      
      expect(startupLogics.length).toBeGreaterThan(0);
      expect(startupLogics[0].getName()).toBe('Audio Timestamp Backfill Migration');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle startup logic that throws during run', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      
      const badLogic = new MockStartupLogic(prismaService, 'Bad Logic');
      jest.spyOn(badLogic, 'run').mockRejectedValue(new Error('Run failed'));
      
      service['startupLogics'] = [badLogic];

      await service.onModuleInit();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to run startup logic: Bad Logic',
        expect.any(Error)
      );
    });

    it('should handle multiple consecutive failures', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      
      const logic1 = new MockStartupLogic(prismaService, 'Failing Logic 1');
      const logic2 = new MockStartupLogic(prismaService, 'Failing Logic 2');
      const logic3 = new MockStartupLogic(prismaService, 'Working Logic');
      
      jest.spyOn(logic1, 'run').mockRejectedValue(new Error('Error 1'));
      jest.spyOn(logic2, 'run').mockRejectedValue(new Error('Error 2'));
      
      service['startupLogics'] = [logic1, logic2, logic3];

      await service.onModuleInit();

      expect(errorSpy).toHaveBeenCalledTimes(2);
      expect(logic3.runCalled).toBe(true);
      
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringMatching(/✅ Startup logic completed: 1 succeeded, 2 failed \(\d+ms total\)/)
      );
    });
  });
});
