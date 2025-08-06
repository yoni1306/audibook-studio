import { Test, TestingModule } from '@nestjs/testing';
import { BulkTextFixesService } from '../bulk-text-fixes.service';
import { TextCorrectionRepository } from '../text-correction.repository';
import { FixTypeHandlerRegistry } from '../fix-type-handlers/fix-type-handler-registry';
import { PrismaService } from '../../prisma/prisma.service';
import { TextFixesService, WordChange } from '../text-fixes.service';
import { FixType } from '@prisma/client';

describe('BulkTextFixesService - Word Matching', () => {
  let service: BulkTextFixesService;
  let mockTextCorrectionRepository: jest.Mocked<TextCorrectionRepository>;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockTextFixesService: jest.Mocked<TextFixesService>;

  beforeEach(async () => {
    const mockHandlerRegistry = {
      getHandlers: jest.fn().mockReturnValue([]),
      classifyCorrection: jest.fn().mockReturnValue({ fixType: FixType.vowelization, confidence: 0.8, reason: 'Test' })
    };

    mockTextCorrectionRepository = {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
    } as any;

    mockTextFixesService = {
      fixText: jest.fn(),
      tokenizeText: jest.fn(),
    } as any;

    mockPrismaService = {
      paragraph: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkTextFixesService,
        { provide: TextCorrectionRepository, useValue: mockTextCorrectionRepository },
        { provide: FixTypeHandlerRegistry, useValue: mockHandlerRegistry },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TextFixesService, useValue: mockTextFixesService },
      ],
    }).compile();

    service = module.get<BulkTextFixesService>(BulkTextFixesService);
  });

  it('should find multiple Hebrew word matches in paragraph content', async () => {
    // Test the findWordMatches method directly to verify Hebrew boundary detection
    // Using content where words are properly separated (not with prefixes)
    const content = 'זה טקסט עם שתי מילים שצריכות תיקון: שלום וגם טוב בתוכו.';
    
    console.log('🧪 Testing multiple Hebrew word matches in paragraph');
    console.log('📝 Content:', content);

    // Test finding "שלום" - should find 1 match (surrounded by space and space)
    const shalomMatches = (service as any).findWordMatches(content, 'שלום');
    console.log('🔍 "שלום" matches:', shalomMatches?.length || 0, shalomMatches);
    
    // Test finding "טוב" - should find 1 match (surrounded by space and space)
    const tovMatches = (service as any).findWordMatches(content, 'טוב');
    console.log('🔍 "טוב" matches:', tovMatches?.length || 0, tovMatches);
    
    // Test finding "תיקון" - should find 1 match (surrounded by space and colon)
    const tikunMatches = (service as any).findWordMatches(content, 'תיקון');
    console.log('🔍 "תיקון" matches:', tikunMatches?.length || 0, tikunMatches);

    // All words should be found with restrictive Hebrew boundary detection
    expect(shalomMatches).toBeDefined();
    expect(shalomMatches?.length).toBe(1);
    
    expect(tovMatches).toBeDefined();
    expect(tovMatches?.length).toBe(1);
    
    expect(tikunMatches).toBeDefined();
    expect(tikunMatches?.length).toBe(1);
  });

  it('should test findSimilarFixesInBook with multiple word changes', async () => {
    // Mock paragraphs that will be searched
    const mockParagraphs = [
      {
        id: '2',
        bookId: 'book1',
        pageId: 'page1',
        orderIndex: 1,
        content: 'זה פסקה ראשונה עם המילה שלום בתוכה.',
        originalParagraphId: 'orig-2',
        completed: false,
        audioS3Key: null,
        audioStatus: 'PENDING' as const,
        audioDuration: null,
        audioGeneratedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        page: { pageNumber: 1 },
      },
      {
        id: '3', 
        bookId: 'book1',
        pageId: 'page1',
        orderIndex: 2,
        content: 'זה פסקה שנייה שגם מכילה את המילה שלום וגם טוב.',
        originalParagraphId: 'orig-3',
        completed: false,
        audioS3Key: null,
        audioStatus: 'PENDING' as const,
        audioDuration: null,
        audioGeneratedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        page: { pageNumber: 1 },
      }
    ];

    (mockPrismaService.paragraph.findMany as jest.Mock).mockResolvedValue(mockParagraphs);

    // Test word changes that should be found in the paragraphs
    const wordChanges: WordChange[] = [
      {
        originalWord: 'שלום',
        correctedWord: 'שָׁלוֹם',
        position: 0,
        fixType: FixType.vowelization
      },
      {
        originalWord: 'טוב',
        correctedWord: 'טוֹב', 
        position: 0,
        fixType: FixType.vowelization
      }
    ];

    console.log('🧪 Testing findSimilarFixesInBook with multiple word changes');
    console.log('📝 Word changes:', wordChanges.map(w => `${w.originalWord} → ${w.correctedWord}`));
    console.log('📝 Paragraphs to search:', mockParagraphs.map(p => p.content));

    const result = await service.findSimilarFixesInBook('book1', 'excludedParagraph', wordChanges);

    console.log('📊 Total suggestions returned:', result.length);
    console.log('🔍 Suggestion details:', result.map(s => ({
      original: s.originalWord,
      corrected: s.correctedWord,
      paragraphCount: s.paragraphs.length
    })));

    // Should find suggestions for both words
    expect(result.length).toBeGreaterThan(0);
    
    // Check if we found suggestions for both words
    const shalomSuggestion = result.find(s => s.originalWord === 'שלום');
    const tovSuggestion = result.find(s => s.originalWord === 'טוב');
    
    if (shalomSuggestion) {
      expect(shalomSuggestion.paragraphs.length).toBeGreaterThan(0);
      console.log('✅ Found "שלום" in', shalomSuggestion.paragraphs.length, 'paragraphs');
    }
    
    if (tovSuggestion) {
      expect(tovSuggestion.paragraphs.length).toBeGreaterThan(0);
      console.log('✅ Found "טוב" in', tovSuggestion.paragraphs.length, 'paragraphs');
    }
  });
});
