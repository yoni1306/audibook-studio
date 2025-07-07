import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TextCorrection, Prisma, FixType } from '@prisma/client';

export interface CreateTextCorrectionData {
  bookId: string;
  paragraphId: string;
  originalWord: string;
  correctedWord: string;
  sentenceContext: string;
  fixType: FixType; // Required - uses FixType enum from schema
  ttsModel?: string;
  ttsVoice?: string;
}

export interface TextCorrectionFilters {
  bookId?: string;
  paragraphId?: string;
  originalWord?: string;
  correctedWord?: string;
  fixType?: FixType;
  ttsModel?: string;
  ttsVoice?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  orderBy?: 'asc' | 'desc';
  minOccurrences?: number;
}

export interface CorrectionStats {
  totalCorrections: number;
  uniqueWords: number;
  fixTypeBreakdown: Array<{
    fixType: string;
    count: number;
  }>;
}

export interface CorrectionWithBookInfo {
  id: string;
  originalWord: string;
  correctedWord: string;
  sentenceContext: string;
  fixType: FixType;
  createdAt: Date;
  updatedAt: Date;
  bookId: string;
  bookTitle: string;
  book: {
    id: string;
    title: string;
    author: string | null;
  };
  location: {
    pageId: string;
    pageNumber: number;
    paragraphId: string;
    paragraphIndex: number;
  };
}

@Injectable()
export class TextCorrectionRepository {
  private readonly logger = new Logger(TextCorrectionRepository.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a single text correction record
   */
  async create(data: CreateTextCorrectionData): Promise<TextCorrection> {
    this.logger.log(`Creating text correction: "${data.originalWord}" → "${data.correctedWord}"`);
    
    try {
      const correction = await this.prisma.textCorrection.create({
        data: {
          bookId: data.bookId,
          paragraphId: data.paragraphId,
          originalWord: data.originalWord,
          correctedWord: data.correctedWord,
          sentenceContext: data.sentenceContext,
          fixType: data.fixType,
          ttsModel: data.ttsModel,
          ttsVoice: data.ttsVoice,
        },
      });

      this.logger.log(`Created text correction with ID: ${correction.id}`);
      return correction;
    } catch (error) {
      this.logger.error(`Failed to create text correction:`, error);
      throw error;
    }
  }

  /**
   * Create multiple text correction records in a batch
   */
  async createMany(data: CreateTextCorrectionData[]): Promise<{ count: number }> {
    this.logger.log(`Creating ${data.length} text corrections in batch`);
    
    try {
      const result = await this.prisma.textCorrection.createMany({
        data: data.map(correction => ({
          bookId: correction.bookId,
          paragraphId: correction.paragraphId,
          originalWord: correction.originalWord,
          correctedWord: correction.correctedWord,
          sentenceContext: correction.sentenceContext,
          fixType: correction.fixType,
          ttsModel: correction.ttsModel,
          ttsVoice: correction.ttsVoice,
        })),
      });

      this.logger.log(`Created ${result.count} text corrections`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create text corrections in batch:`, error);
      throw error;
    }
  }

  /**
   * Find text corrections with optional filters
   */
  async findMany(filters: TextCorrectionFilters = {}): Promise<TextCorrection[]> {
    this.logger.log(`Finding text corrections with filters:`, filters);
    
    const where: Prisma.TextCorrectionWhereInput = {};
    
    if (filters.bookId) where.bookId = filters.bookId;
    if (filters.paragraphId) where.paragraphId = filters.paragraphId;
    if (filters.originalWord) where.originalWord = filters.originalWord;
    if (filters.correctedWord) where.correctedWord = filters.correctedWord;
    if (filters.fixType) where.fixType = filters.fixType;
    if (filters.ttsModel) where.ttsModel = filters.ttsModel;
    if (filters.ttsVoice) where.ttsVoice = filters.ttsVoice;
    if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
    if (filters.createdBefore) {
      where.createdAt = where.createdAt ? { ...where.createdAt as object, lte: filters.createdBefore } : { lte: filters.createdBefore };
    }
    
    try {
      const corrections = await this.prisma.textCorrection.findMany({
        where,
        orderBy: { createdAt: filters.orderBy || 'desc' },
        take: filters.limit,
      });
      
      this.logger.log(`Found ${corrections.length} text corrections`);
      return corrections;
    } catch (error) {
      this.logger.error(`Failed to find text corrections:`, error);
      throw error;
    }
  }

  /**
   * Find text corrections with book and paragraph information for display
   */
  async findManyWithBookInfo(filters: TextCorrectionFilters = {}): Promise<CorrectionWithBookInfo[]> {
    this.logger.log(`Finding text corrections with book info, filters:`, filters);
    
    const where: Prisma.TextCorrectionWhereInput = {};
    
    if (filters.bookId) where.bookId = filters.bookId;
    if (filters.paragraphId) where.paragraphId = filters.paragraphId;
    if (filters.originalWord) where.originalWord = filters.originalWord;
    if (filters.correctedWord) where.correctedWord = filters.correctedWord;
    if (filters.fixType) where.fixType = filters.fixType;
    if (filters.ttsModel) where.ttsModel = filters.ttsModel;
    if (filters.ttsVoice) where.ttsVoice = filters.ttsVoice;
    if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
    if (filters.createdBefore) {
      where.createdAt = where.createdAt ? { ...where.createdAt as object, lte: filters.createdBefore } : { lte: filters.createdBefore };
    }
    
    try {
      const corrections = await this.prisma.textCorrection.findMany({
        where,
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
          paragraph: {
            select: {
              id: true,
              orderIndex: true,
              page: {
                select: {
                  id: true,
                  pageNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: filters.orderBy || 'desc' },
        take: filters.limit,
      });
      
      // Transform to include proper location and book information
      const transformedCorrections = corrections.map(correction => ({
        id: correction.id,
        originalWord: correction.originalWord,
        correctedWord: correction.correctedWord,
        sentenceContext: correction.sentenceContext,
        fixType: correction.fixType,
        createdAt: correction.createdAt,
        updatedAt: correction.updatedAt,
        bookId: correction.bookId,
        bookTitle: correction.book?.title || 'Unknown Book',
        book: {
          id: correction.book?.id || correction.bookId,
          title: correction.book?.title || 'Unknown Book',
          author: correction.book?.author || null,
        },
        location: {
          pageId: correction.paragraph?.page?.id || '',
          pageNumber: correction.paragraph?.page?.pageNumber || 0,
          paragraphId: correction.paragraphId,
          paragraphIndex: correction.paragraph?.orderIndex || 0,
        },
      }));
      
      this.logger.log(`Found ${transformedCorrections.length} text corrections with book info`);
      return transformedCorrections;
    } catch (error) {
      this.logger.error(`Failed to find text corrections with book info:`, error);
      throw error;
    }
  }

  /**
   * Find text corrections grouped by original and corrected word
   */
  async findGroupedCorrections(filters: TextCorrectionFilters = {}) {
    this.logger.log(`Finding grouped text corrections with filters:`, filters);
    
    const where: Prisma.TextCorrectionWhereInput = {};
    
    if (filters.bookId) where.bookId = filters.bookId;
    if (filters.paragraphId) where.paragraphId = filters.paragraphId;
    if (filters.fixType) where.fixType = filters.fixType;

    try {
      const groupedCorrections = await this.prisma.textCorrection.groupBy({
        by: ['originalWord', 'correctedWord', 'fixType'],
        where,
        _count: {
          id: true,
        },
        having: filters.minOccurrences ? {
          id: {
            _count: {
              gte: filters.minOccurrences,
            },
          },
        } : undefined,
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      this.logger.log(`Found ${groupedCorrections.length} grouped corrections`);
      return groupedCorrections.map(group => ({
        originalWord: group.originalWord,
        correctedWord: group.correctedWord,
        fixType: group.fixType,
        occurrenceCount: group._count.id,
      }));
    } catch (error) {
      this.logger.error(`Failed to find grouped text corrections:`, error);
      throw error;
    }
  }

  /**
   * Get correction statistics
   */
  async getStats(filters: TextCorrectionFilters = {}): Promise<CorrectionStats> {
    this.logger.log(`Getting correction statistics with filters:`, filters);
    
    const where: Prisma.TextCorrectionWhereInput = {};
    
    if (filters.bookId) where.bookId = filters.bookId;
    if (filters.paragraphId) where.paragraphId = filters.paragraphId;
    if (filters.fixType) where.fixType = filters.fixType;

    try {
      // Get total corrections
      const totalCorrections = await this.prisma.textCorrection.count({ where });

      // Get unique words count
      const uniqueWords = await this.prisma.textCorrection.groupBy({
        by: ['originalWord'],
        where,
      });

      // Get fix type breakdown
      const fixTypeBreakdown = await this.prisma.textCorrection.groupBy({
        by: ['fixType'],
        where,
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });

      const stats: CorrectionStats = {
        totalCorrections,
        uniqueWords: uniqueWords.length,
        fixTypeBreakdown: fixTypeBreakdown.map(group => ({
          fixType: group.fixType || 'unknown',
          count: group._count.id,
        })),
      };

      this.logger.log(`Generated correction statistics:`, stats);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get correction statistics:`, error);
      throw error;
    }
  }

  /**
   * Delete text corrections by ID
   */
  async delete(id: string): Promise<TextCorrection> {
    this.logger.log(`Deleting text correction with ID: ${id}`);
    
    try {
      const deleted = await this.prisma.textCorrection.delete({
        where: { id },
      });

      this.logger.log(`Deleted text correction: "${deleted.originalWord}" → "${deleted.correctedWord}"`);
      return deleted;
    } catch (error) {
      this.logger.error(`Failed to delete text correction with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple text corrections by filters
   */
  async deleteMany(filters: TextCorrectionFilters): Promise<{ count: number }> {
    this.logger.log(`Deleting text corrections with filters:`, filters);
    
    const where: Prisma.TextCorrectionWhereInput = {};
    
    if (filters.bookId) where.bookId = filters.bookId;
    if (filters.paragraphId) where.paragraphId = filters.paragraphId;
    if (filters.originalWord) where.originalWord = filters.originalWord;
    if (filters.correctedWord) where.correctedWord = filters.correctedWord;
    if (filters.fixType) where.fixType = filters.fixType;

    try {
      const result = await this.prisma.textCorrection.deleteMany({ where });
      
      this.logger.log(`Deleted ${result.count} text corrections`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete text corrections:`, error);
      throw error;
    }
  }

  /**
   * Update a text correction
   */
  async update(id: string, data: Partial<CreateTextCorrectionData>): Promise<TextCorrection> {
    this.logger.log(`Updating text correction with ID: ${id}`);
    
    try {
      const updated = await this.prisma.textCorrection.update({
        where: { id },
        data: {
          ...(data.bookId && { bookId: data.bookId }),
          ...(data.paragraphId && { paragraphId: data.paragraphId }),
          ...(data.originalWord && { originalWord: data.originalWord }),
          ...(data.correctedWord && { correctedWord: data.correctedWord }),
          ...(data.sentenceContext && { sentenceContext: data.sentenceContext }),
          ...(data.fixType && { fixType: data.fixType }),
          ...(data.ttsModel && { ttsModel: data.ttsModel }),
          ...(data.ttsVoice && { ttsVoice: data.ttsVoice }),
        },
      });

      this.logger.log(`Updated text correction: "${updated.originalWord}" → "${updated.correctedWord}"`);
      return updated;
    } catch (error) {
      this.logger.error(`Failed to update text correction with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find a single text correction by ID
   */
  async findById(id: string): Promise<TextCorrection | null> {
    this.logger.log(`Finding text correction by ID: ${id}`);
    
    try {
      const correction = await this.prisma.textCorrection.findUnique({
        where: { id },
      });

      if (correction) {
        this.logger.log(`Found text correction: "${correction.originalWord}" → "${correction.correctedWord}"`);
      } else {
        this.logger.log(`Text correction with ID ${id} not found`);
      }

      return correction;
    } catch (error) {
      this.logger.error(`Failed to find text correction by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get top corrections by occurrence count
   */
  async getTopCorrections(options: { take?: number } = {}) {
    this.logger.log('Getting top corrections');
    
    try {
      const topCorrections = await this.prisma.textCorrection.groupBy({
        by: ['originalWord', 'correctedWord', 'fixType'],
        _count: {
          id: true,
        },
        _max: {
          updatedAt: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: options.take || 10,
      });
      
      const result = topCorrections.map(correction => ({
        originalWord: correction.originalWord,
        correctedWord: correction.correctedWord,
        fixType: correction.fixType,
        occurrenceCount: correction._count.id,
        lastUsed: correction._max.updatedAt,
      }));
      
      this.logger.log(`Found ${result.length} top corrections`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get top corrections:`, error);
      throw error;
    }
  }
}
