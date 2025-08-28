import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { StartupLogicBase } from './startup-logic.base';

// Concrete implementation for testing
class TestStartupLogic extends StartupLogicBase {
  public shouldRunResult = true;
  public executeError: Error | null = null;
  public executeCalled = false;

  getName(): string {
    return 'Test Startup Logic';
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
}

describe('StartupLogicBase', () => {
  let startupLogic: TestStartupLogic;
  let prismaService: jest.Mocked<PrismaService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: {
            // Mock any prisma methods if needed
          },
        },
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>;
    startupLogic = new TestStartupLogic(prismaService);
    
    // Spy on logger methods
    loggerSpy = jest.spyOn(startupLogic['logger'], 'log').mockImplementation();
    jest.spyOn(startupLogic['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('run', () => {
    it('should execute startup logic when shouldRun returns true', async () => {
      startupLogic.shouldRunResult = true;

      await startupLogic.run();

      expect(startupLogic.executeCalled).toBe(true);
      expect(loggerSpy).toHaveBeenCalledWith('🔍 Checking if startup logic should run: Test Startup Logic');
      expect(loggerSpy).toHaveBeenCalledWith('🚀 Running startup logic: Test Startup Logic');
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringMatching(/✅ Completed startup logic: Test Startup Logic \(\d+ms\)/));
    });

    it('should skip startup logic when shouldRun returns false', async () => {
      startupLogic.shouldRunResult = false;

      await startupLogic.run();

      expect(startupLogic.executeCalled).toBe(false);
      expect(loggerSpy).toHaveBeenCalledWith('🔍 Checking if startup logic should run: Test Startup Logic');
      expect(loggerSpy).toHaveBeenCalledWith('⏭️ Skipping startup logic: Test Startup Logic (conditions not met)');
    });

    it('should handle errors during shouldRun gracefully', async () => {
      const errorSpy = jest.spyOn(startupLogic['logger'], 'error');
      jest.spyOn(startupLogic, 'shouldRun').mockRejectedValue(new Error('shouldRun failed'));

      await startupLogic.run();

      expect(startupLogic.executeCalled).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        '❌ Failed to run startup logic: Test Startup Logic',
        expect.any(Error)
      );
    });

    it('should handle errors during execute gracefully', async () => {
      const errorSpy = jest.spyOn(startupLogic['logger'], 'error');
      startupLogic.shouldRunResult = true;
      startupLogic.executeError = new Error('Execute failed');

      await startupLogic.run();

      expect(startupLogic.executeCalled).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(
        '❌ Failed to run startup logic: Test Startup Logic',
        expect.any(Error)
      );
    });

    it('should measure execution time', async () => {
      startupLogic.shouldRunResult = true;
      
      // Mock Date.now to control timing
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1500; // 500ms duration
      });

      await startupLogic.run();

      expect(loggerSpy).toHaveBeenCalledWith('✅ Completed startup logic: Test Startup Logic (500ms)');

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should create logger with custom context when provided', () => {
      const customStartupLogic = new TestStartupLogic(prismaService, 'CustomContext');
      
      // Verify the logger was created (we can't access the protected context property)
      expect(customStartupLogic['logger']).toBeDefined();
    });

    it('should create logger with default context when no custom context provided', () => {
      // Verify the logger was created with default context
      expect(startupLogic['logger']).toBeDefined();
    });
  });

  describe('abstract methods', () => {
    it('should require getName implementation', () => {
      expect(startupLogic.getName()).toBe('Test Startup Logic');
    });

    it('should require shouldRun implementation', async () => {
      const result = await startupLogic.shouldRun();
      expect(typeof result).toBe('boolean');
    });

    it('should require execute implementation', async () => {
      await expect(startupLogic.execute()).resolves.toBeUndefined();
    });
  });
});
