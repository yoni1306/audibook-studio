import { Test, TestingModule } from '@nestjs/testing';
import { StartupModule } from './startup.module';
import { StartupService } from './startup.service';
import { AudioTimestampBackfillStartup } from './logic/audio-timestamp-backfill.startup';
import { PrismaService } from '../prisma/prisma.service';

describe('Startup System Integration', () => {
  let module: TestingModule;
  let startupService: StartupService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [StartupModule],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            paragraph: {
              count: jest.fn(),
            },
            $executeRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    startupService = module.get<StartupService>(StartupService);

    // Mock logger to avoid console output during tests
    jest.spyOn(startupService['logger'], 'log').mockImplementation();
    jest.spyOn(startupService['logger'], 'error').mockImplementation();
    jest.spyOn(startupService['logger'], 'warn').mockImplementation();
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('End-to-End Startup Flow', () => {
    it('should initialize startup service without errors', async () => {
      // This test verifies that the startup service can be created and initialized
      // without throwing errors, even with mocked dependencies
      expect(startupService).toBeDefined();
      expect(startupService.getRegisteredStartupLogics()).toBeDefined();
    });

    it('should have AudioTimestampBackfillStartup registered', () => {
      const registeredLogics = startupService.getRegisteredStartupLogics();
      expect(registeredLogics).toContain('Audio Timestamp Backfill Migration');
    });

    it('should handle onModuleInit without throwing', async () => {
      // Mock the startup logic to skip execution to avoid complex mock setup
      const startupLogics = startupService['startupLogics'];
      for (const logic of startupLogics) {
        jest.spyOn(logic, 'shouldRun').mockResolvedValue(false);
      }

      await expect(startupService.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('Startup Logic Registration and Execution', () => {
    it('should have AudioTimestampBackfillStartup registered', () => {
      const registeredLogics = startupService.getRegisteredStartupLogics();
      expect(registeredLogics).toContain('Audio Timestamp Backfill Migration');
    });

    it('should execute all registered startup logic', async () => {
      // Mock all startup logic to skip execution
      const startupLogics = startupService['startupLogics'];
      const runSpies = startupLogics.map(logic => 
        jest.spyOn(logic, 'shouldRun').mockResolvedValue(false)
      );

      await startupService.onModuleInit();

      // Verify all startup logic was checked
      runSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('should continue with other startup logic if one fails', async () => {
      // Get the actual startup logics
      const startupLogics = startupService['startupLogics'];
      
      if (startupLogics.length > 1) {
        // Make the first one fail
        jest.spyOn(startupLogics[0], 'shouldRun').mockRejectedValue(new Error('First logic failed'));
        
        // Make the second one succeed but skip execution
        jest.spyOn(startupLogics[1], 'shouldRun').mockResolvedValue(false);

        await startupService.onModuleInit();

        // Both should have been attempted
        expect(startupLogics[0].shouldRun).toHaveBeenCalled();
        expect(startupLogics[1].shouldRun).toHaveBeenCalled();
      }
    });
  });

  describe('Real AudioTimestampBackfillStartup Integration', () => {
    let audioBackfillLogic: AudioTimestampBackfillStartup;

    beforeEach(() => {
      // Get the actual AudioTimestampBackfillStartup instance
      const startupLogics = startupService['startupLogics'];
      audioBackfillLogic = startupLogics.find(
        logic => logic.getName() === 'Audio Timestamp Backfill Migration'
      ) as AudioTimestampBackfillStartup;

      // Mock its logger too
      jest.spyOn(audioBackfillLogic['logger'], 'log').mockImplementation();
      jest.spyOn(audioBackfillLogic['logger'], 'error').mockImplementation();
      jest.spyOn(audioBackfillLogic['logger'], 'warn').mockImplementation();
    });

    it('should be properly instantiated', () => {
      expect(audioBackfillLogic).toBeDefined();
      expect(audioBackfillLogic.getName()).toBe('Audio Timestamp Backfill Migration');
    });

    it('should have access to prisma service', () => {
      // Verify that the startup logic has access to the prisma service
      expect(audioBackfillLogic['prisma']).toBeDefined();
    });

    it('should implement required abstract methods', () => {
      expect(typeof audioBackfillLogic.getName).toBe('function');
      expect(typeof audioBackfillLogic.shouldRun).toBe('function');
      expect(typeof audioBackfillLogic.execute).toBe('function');
    });
  });

  describe('Module Lifecycle Integration', () => {
    it('should integrate properly with NestJS module lifecycle', async () => {
      // Mock to skip actual execution
      jest.spyOn(startupService['startupLogics'][0], 'shouldRun').mockResolvedValue(false);

      // This simulates what happens during actual application startup
      await expect(startupService.onModuleInit()).resolves.toBeUndefined();
    });

    it('should not block application startup on startup logic failures', async () => {
      // Make startup logic fail
      jest.spyOn(startupService['startupLogics'][0], 'shouldRun')
        .mockRejectedValue(new Error('Startup logic failed'));

      // Application startup should continue
      await expect(startupService.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('Performance and Timing', () => {
    it('should complete startup logic within reasonable time', async () => {
      // Mock to skip actual execution
      jest.spyOn(startupService['startupLogics'][0], 'shouldRun').mockResolvedValue(false);

      const startTime = Date.now();
      await startupService.onModuleInit();
      const duration = Date.now() - startTime;

      // Should complete very quickly when skipping execution
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle multiple startup logic efficiently', async () => {
      // If we add more startup logic in the future, this test ensures
      // they all run efficiently
      const startupLogics = startupService['startupLogics'];
      
      // Mock all to skip execution
      startupLogics.forEach(logic => {
        jest.spyOn(logic, 'shouldRun').mockResolvedValue(false);
      });

      const startTime = Date.now();
      await startupService.onModuleInit();
      const duration = Date.now() - startTime;

      // Should scale well with number of startup logic
      expect(duration).toBeLessThan(startupLogics.length * 100); // 100ms per logic max
    });
  });
});
