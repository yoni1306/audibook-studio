import { Test, TestingModule } from '@nestjs/testing';
import { StartupModule } from './startup.module';
import { StartupService } from './startup.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StartupModule', () => {
  let module: TestingModule;
  let startupService: StartupService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [StartupModule],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            // Mock PrismaService for testing
            paragraph: {
              count: jest.fn(),
            },
            $executeRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    startupService = module.get<StartupService>(StartupService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('module configuration', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should provide StartupService', () => {
      expect(startupService).toBeDefined();
      expect(startupService).toBeInstanceOf(StartupService);
    });

    it('should provide PrismaService', () => {
      expect(prismaService).toBeDefined();
    });

    it('should export StartupService', () => {
      // Test that StartupService can be imported from the module
      const exportedService = module.get<StartupService>(StartupService);
      expect(exportedService).toBe(startupService);
    });
  });

  describe('dependency injection', () => {
    it('should inject PrismaService into StartupService', () => {
      // Verify that StartupService has access to PrismaService
      expect(startupService['prisma']).toBeDefined();
    });

    it('should have registered startup logic', () => {
      const registeredLogics = startupService.getRegisteredStartupLogics();
      expect(registeredLogics).toBeDefined();
      expect(Array.isArray(registeredLogics)).toBe(true);
      expect(registeredLogics.length).toBeGreaterThan(0);
    });

    it('should include AudioTimestampBackfillStartup', () => {
      const registeredLogics = startupService.getRegisteredStartupLogics();
      expect(registeredLogics).toContain('Audio Timestamp Backfill Migration');
    });
  });

  describe('module initialization', () => {
    it('should initialize without errors', async () => {
      // The module should initialize successfully
      expect(module).toBeDefined();
      expect(startupService).toBeDefined();
    });

    it('should be ready for onModuleInit lifecycle', async () => {
      // Mock the startup logic to avoid actual database operations
      jest.spyOn(startupService['logger'], 'log').mockImplementation();
      
      // Mock the startup logic's shouldRun to return false (skip execution)
      const startupLogics = startupService['startupLogics'];
      for (const logic of startupLogics) {
        jest.spyOn(logic, 'shouldRun').mockResolvedValue(false);
      }

      // This should not throw
      await expect(startupService.onModuleInit()).resolves.toBeUndefined();
    });
  });

  describe('integration with other modules', () => {
    it('should work with PrismaModule', () => {
      // Verify that the module can access Prisma functionality
      expect(prismaService).toBeDefined();
      expect(typeof prismaService.paragraph.count).toBe('function');
      expect(typeof prismaService.$executeRaw).toBe('function');
    });
  });

  describe('module exports', () => {
    it('should export StartupService for use in other modules', () => {
      const exports = Reflect.getMetadata('exports', StartupModule);
      expect(exports).toContain(StartupService);
    });
  });

  describe('module imports', () => {
    it('should import PrismaModule', () => {
      const imports = Reflect.getMetadata('imports', StartupModule);
      expect(imports).toBeDefined();
      expect(imports.length).toBeGreaterThan(0);
    });
  });

  describe('providers', () => {
    it('should provide StartupService', () => {
      const providers = Reflect.getMetadata('providers', StartupModule);
      expect(providers).toContain(StartupService);
    });
  });
});
