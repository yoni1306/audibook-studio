import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AudioTimestampBackfillStartup } from './audio-timestamp-backfill.startup';

describe('AudioTimestampBackfillStartup', () => {
  let startupLogic: AudioTimestampBackfillStartup;
  let prismaService: jest.Mocked<PrismaService>;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    prismaService = module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>;
    startupLogic = new AudioTimestampBackfillStartup(prismaService);
    
    // Spy on logger methods
    loggerSpy = jest.spyOn(startupLogic['logger'], 'log').mockImplementation();
    jest.spyOn(startupLogic['logger'], 'error').mockImplementation();
    jest.spyOn(startupLogic['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getName', () => {
    it('should return the correct name', () => {
      expect(startupLogic.getName()).toBe('Audio Timestamp Backfill Migration');
    });
  });

  describe('shouldRun', () => {
    it('should return true when paragraphs need audioGeneratedAt backfill', async () => {
      (prismaService.paragraph.count as jest.Mock).mockResolvedValue(5);

      const result = await startupLogic.shouldRun();

      expect(result).toBe(true);
      expect(prismaService.paragraph.count).toHaveBeenCalledWith({
        where: {
          audioStatus: 'READY',
          audioS3Key: { not: null },
          audioGeneratedAt: null,
        },
      });
      expect(loggerSpy).toHaveBeenCalledWith('Found 5 paragraphs needing audioGeneratedAt backfill');
    });

    it('should return false when no paragraphs need backfill', async () => {
      (prismaService.paragraph.count as jest.Mock).mockResolvedValue(0);

      const result = await startupLogic.shouldRun();

      expect(result).toBe(false);
      expect(loggerSpy).toHaveBeenCalledWith('Found 0 paragraphs needing audioGeneratedAt backfill');
    });

    it('should return false and log error when database query fails', async () => {
      const errorSpy = jest.spyOn(startupLogic['logger'], 'error');
      const dbError = new Error('Database connection failed');
      (prismaService.paragraph.count as jest.Mock).mockRejectedValue(dbError);

      const result = await startupLogic.shouldRun();

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'Error checking if audio timestamp backfill is needed',
        dbError
      );
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Reset mocks for each test
      jest.clearAllMocks();
    });

    it('should successfully execute backfill migration', async () => {
      (prismaService.paragraph.count as jest.Mock)
        .mockResolvedValueOnce(3) // beforeCount
        .mockResolvedValueOnce(0) // afterCount
        .mockResolvedValueOnce(10) // totalReadyParagraphs
        .mockResolvedValueOnce(10); // paragraphsWithTimestamp
      
      (prismaService.$executeRaw as jest.Mock).mockResolvedValue(3);

      await startupLogic.execute();

      expect(loggerSpy).toHaveBeenCalledWith('Starting audio timestamp backfill migration...');
      expect(loggerSpy).toHaveBeenCalledWith('Updating 3 paragraphs with missing audioGeneratedAt timestamps');
      expect(loggerSpy).toHaveBeenCalledWith('Successfully updated 3 paragraphs');
      expect(loggerSpy).toHaveBeenCalledWith('✅ All paragraphs now have audioGeneratedAt timestamps');
      expect(loggerSpy).toHaveBeenCalledWith('📊 Final stats: 10/10 paragraphs have timestamps (100.0% coverage)');
    });

    it('should execute the correct SQL update query', async () => {
      await startupLogic.execute();

      expect(prismaService.$executeRaw).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('UPDATE "paragraphs"'),
          expect.stringContaining('SET "audioGeneratedAt" = "updatedAt"'),
          expect.stringContaining('WHERE "audioStatus" = \'READY\''),
          expect.stringContaining('AND "audioS3Key" IS NOT NULL'),
          expect.stringContaining('AND "audioGeneratedAt" IS NULL'),
        ])
      );
    });

    it('should warn when some paragraphs still missing timestamps after update', async () => {
      const warnSpy = jest.spyOn(startupLogic['logger'], 'warn');
      
      // Mock afterCount to be non-zero
      (prismaService.paragraph.count as jest.Mock)
        .mockResolvedValueOnce(5) // beforeCount
        .mockResolvedValueOnce(2) // afterCount (still missing)
        .mockResolvedValueOnce(10) // totalReadyParagraphs
        .mockResolvedValueOnce(8); // paragraphsWithTimestamp

      (prismaService.$executeRaw as jest.Mock).mockResolvedValue(5);

      await startupLogic.execute();

      expect(warnSpy).toHaveBeenCalledWith('⚠️ 2 paragraphs still missing audioGeneratedAt timestamps');
      expect(loggerSpy).toHaveBeenCalledWith('📊 Final stats: 8/10 paragraphs have timestamps (80.0% coverage)');
    });

    it('should handle zero total paragraphs correctly', async () => {
      (prismaService.paragraph.count as jest.Mock)
        .mockResolvedValueOnce(0) // beforeCount
        .mockResolvedValueOnce(0) // afterCount
        .mockResolvedValueOnce(0) // totalReadyParagraphs
        .mockResolvedValueOnce(0); // paragraphsWithTimestamp

      (prismaService.$executeRaw as jest.Mock).mockResolvedValue(0);

      await startupLogic.execute();

      expect(loggerSpy).toHaveBeenCalledWith('Updating 0 paragraphs with missing audioGeneratedAt timestamps');
      expect(loggerSpy).toHaveBeenCalledWith('📊 Final stats: 0/0 paragraphs have timestamps (0% coverage)');
    });

    it('should calculate coverage percentage correctly', async () => {
      (prismaService.paragraph.count as jest.Mock)
        .mockResolvedValueOnce(7) // beforeCount
        .mockResolvedValueOnce(0) // afterCount
        .mockResolvedValueOnce(15) // totalReadyParagraphs
        .mockResolvedValueOnce(12); // paragraphsWithTimestamp

      await startupLogic.execute();

      expect(loggerSpy).toHaveBeenCalledWith('Updating 7 paragraphs with missing audioGeneratedAt timestamps');
      expect(loggerSpy).toHaveBeenCalledWith('📊 Final stats: 12/15 paragraphs have timestamps (80.0% coverage)');
    });

    it('should handle database errors during execution', async () => {
      const errorSpy = jest.spyOn(startupLogic['logger'], 'error');
      const dbError = new Error('Database update failed');
      
      (prismaService.$executeRaw as jest.Mock).mockRejectedValue(dbError);

      await expect(startupLogic.execute()).rejects.toThrow('Database update failed');
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Error during audio timestamp backfill migration',
        dbError
      );
    });

    it('should handle errors during count queries', async () => {
      const errorSpy = jest.spyOn(startupLogic['logger'], 'error');
      const countError = new Error('Count query failed');
      
      // First count succeeds, executeRaw succeeds, second count fails
      (prismaService.paragraph.count as jest.Mock)
        .mockResolvedValueOnce(3) // beforeCount succeeds
        .mockRejectedValueOnce(countError); // afterCount fails

      (prismaService.$executeRaw as jest.Mock).mockResolvedValue(3);

      await expect(startupLogic.execute()).rejects.toThrow('Count query failed');
      
      expect(errorSpy).toHaveBeenCalledWith(
        'Error during audio timestamp backfill migration',
        countError
      );
    });

    it('should log all intermediate steps', async () => {
      // Setup successful execution scenario
      (prismaService.paragraph.count as jest.Mock)
        .mockResolvedValueOnce(3) // beforeCount
        .mockResolvedValueOnce(0) // afterCount
        .mockResolvedValueOnce(10) // totalReadyParagraphs
        .mockResolvedValueOnce(10); // paragraphsWithTimestamp
      
      (prismaService.$executeRaw as jest.Mock).mockResolvedValue(3);

      await startupLogic.execute();

      // Verify all expected log calls
      expect(loggerSpy).toHaveBeenCalledWith('Starting audio timestamp backfill migration...');
      expect(loggerSpy).toHaveBeenCalledWith('Updating 3 paragraphs with missing audioGeneratedAt timestamps');
      expect(loggerSpy).toHaveBeenCalledWith('Successfully updated 3 paragraphs');
      expect(loggerSpy).toHaveBeenCalledWith('✅ All paragraphs now have audioGeneratedAt timestamps');
      expect(loggerSpy).toHaveBeenCalledWith('📊 Final stats: 10/10 paragraphs have timestamps (100.0% coverage)');
    });
  });

  describe('integration', () => {
    it('should work end-to-end when conditions are met', async () => {
      // Setup: paragraphs need backfill
      (prismaService.paragraph.count as jest.Mock)
        .mockResolvedValueOnce(2) // shouldRun check
        .mockResolvedValueOnce(2) // beforeCount
        .mockResolvedValueOnce(0) // afterCount
        .mockResolvedValueOnce(5) // totalReadyParagraphs
        .mockResolvedValueOnce(5); // paragraphsWithTimestamp

      (prismaService.$executeRaw as jest.Mock).mockResolvedValue(2);

      // Test shouldRun
      const shouldRun = await startupLogic.shouldRun();
      expect(shouldRun).toBe(true);

      // Test execute
      await startupLogic.execute();

      // Verify complete flow
      expect(prismaService.paragraph.count).toHaveBeenCalledTimes(5);
      expect(prismaService.$executeRaw).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith('Found 2 paragraphs needing audioGeneratedAt backfill');
      expect(loggerSpy).toHaveBeenCalledWith('Successfully updated 2 paragraphs');
    });

    it('should skip execution when no paragraphs need backfill', async () => {
      (prismaService.paragraph.count as jest.Mock).mockResolvedValue(0);

      const shouldRun = await startupLogic.shouldRun();
      expect(shouldRun).toBe(false);

      // execute should not be called in this case, but if it were:
      // it would still work correctly with 0 paragraphs
    });
  });
});
