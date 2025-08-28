import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TtsModelDefaultStartup } from './tts-model-default.startup';

describe('TtsModelDefaultStartup', () => {
  let startup: TtsModelDefaultStartup;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useValue: {
            book: {
              count: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService) as jest.Mocked<PrismaService>;
    startup = new TtsModelDefaultStartup(prismaService);
  });

  describe('getName', () => {
    it('should return the correct name', () => {
      expect(startup.getName()).toBe('TTS Model Default Migration');
    });
  });

  describe('shouldRun', () => {
    it('should return true when there are books without TTS model', async () => {
      (prismaService.book.count as jest.Mock).mockResolvedValue(5);

      const result = await startup.shouldRun();

      expect(result).toBe(true);
      expect(prismaService.book.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
        },
      });
    });

    it('should return false when all books have TTS model', async () => {
      (prismaService.book.count as jest.Mock).mockResolvedValue(0);

      const result = await startup.shouldRun();

      expect(result).toBe(false);
    });

    it('should return false when database error occurs', async () => {
      (prismaService.book.count as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await startup.shouldRun();

      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should successfully update books without TTS model', async () => {
      // Mock the count calls
      (prismaService.book.count as jest.Mock)
        .mockResolvedValueOnce(3) // Initial count
        .mockResolvedValueOnce(0); // Final count after update

      // Mock the update operation
      (prismaService.book.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      await startup.execute();

      expect(prismaService.book.count).toHaveBeenCalledTimes(2);
      expect(prismaService.book.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { ttsModel: null },
            { ttsModel: '' },
          ],
        },
        data: {
          ttsModel: 'azure',
        },
      });
    });

    it('should handle case where some books remain unupdated', async () => {
      // Mock the count calls
      (prismaService.book.count as jest.Mock)
        .mockResolvedValueOnce(5) // Initial count
        .mockResolvedValueOnce(2); // Final count after update (some remain)

      // Mock the update operation
      (prismaService.book.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      await startup.execute();

      expect(prismaService.book.count).toHaveBeenCalledTimes(2);
      expect(prismaService.book.updateMany).toHaveBeenCalledTimes(1);
    });

    it('should throw error when update fails', async () => {
      (prismaService.book.count as jest.Mock).mockResolvedValue(3);
      (prismaService.book.updateMany as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await expect(startup.execute()).rejects.toThrow('Update failed');
    });

    it('should handle zero books to update', async () => {
      // Mock the count calls
      (prismaService.book.count as jest.Mock)
        .mockResolvedValueOnce(0) // Initial count
        .mockResolvedValueOnce(0); // Final count after update

      // Mock the update operation
      (prismaService.book.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await startup.execute();

      expect(prismaService.book.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
