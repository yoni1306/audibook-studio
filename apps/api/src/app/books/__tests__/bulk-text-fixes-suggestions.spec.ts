import { Test, TestingModule } from '@nestjs/testing';
import { BulkTextFixesService } from '../bulk-text-fixes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FixTypeHandlerRegistry } from '../fix-type-handlers/fix-type-handler-registry';
import { TextCorrectionRepository } from '../text-correction.repository';
import { TextFixesService } from '../text-fixes.service';
import { Logger } from '@nestjs/common';

describe('BulkTextFixesService - Bulk Suggestions', () => {
  let service: BulkTextFixesService;
  let prismaService: PrismaService;

  const mockBook = {
    id: 'book-1',
    title: 'Test Book',
    paragraphs: [
      {
        id: 'para-1',
        pageId: 'page-1',
        orderIndex: 0,
        content: 'זה טקסט עם שתי מילים שצריכות תיקון: שלום וטוב.',
        page: { pageNumber: 1 }
      },
      {
        id: 'para-2', 
        pageId: 'page-1',
        orderIndex: 1,
        content: 'זה פסקה נוספת עם שלום וגם עם טוב בתוכה.',
        page: { pageNumber: 1 }
      },
      {
        id: 'para-3',
        pageId: 'page-2', 
        orderIndex: 2,
        content: 'פסקה שלישית עם רק שלום בתוכה.',
        page: { pageNumber: 2 }
      }
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkTextFixesService,
        {
          provide: PrismaService,
          useValue: {
            book: {
              findUnique: jest.fn(),
            },
            paragraph: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: FixTypeHandlerRegistry,
          useValue: {
            classifyCorrection: jest.fn(),
          },
        },
        {
          provide: TextCorrectionRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: TextFixesService,
          useValue: {
            analyzeTextChanges: jest.fn(),
            saveTextFixes: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            debug: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BulkTextFixesService>(BulkTextFixesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('Multiple fixes in same paragraph scenario', () => {
    it('should return separate suggestions for each word change, even if they appear in the same paragraphs', async () => {
      // Mock the book query to return our test data
      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBook);
      
      // Mock the paragraph query to return paragraphs (excluding the specified one)
      (prismaService.paragraph.findMany as jest.Mock).mockImplementation((query) => {
        const excludeId = query?.where?.id?.not;
        const filteredParagraphs = excludeId 
          ? mockBook.paragraphs.filter(p => p.id !== excludeId)
          : mockBook.paragraphs;
        return Promise.resolve(filteredParagraphs);
      });

      // Simulate word changes from editing a paragraph
      const wordChanges = [
        {
          originalWord: 'שלום',
          correctedWord: 'שלום עליכם',
          fixType: 'expansion' as const,
          position: 0
        },
        {
          originalWord: 'טוב',
          correctedWord: 'מצוין',
          fixType: 'disambiguation' as const,
          position: 1
        }
      ];

      console.log('🧪 Testing bulk suggestions with multiple word changes...');
      console.log('📝 Word changes:', wordChanges);
      console.log('📚 Mock book paragraphs:', mockBook.paragraphs.map(p => ({ id: p.id, content: p.content })));

      // Call the service method
      const suggestions = await service.findSimilarFixesInBook(
        'book-1',
        'para-excluded', // Exclude a non-existent paragraph
        wordChanges
      );

      console.log('🎯 Bulk suggestions result:', suggestions);
      console.log('📊 Number of suggestions:', suggestions.length);

      // Log detailed analysis
      suggestions.forEach((suggestion, index) => {
        console.log(`\n📋 Suggestion ${index + 1}:`);
        console.log(`   Original: "${suggestion.originalWord}"`);
        console.log(`   Corrected: "${suggestion.correctedWord}"`);
        console.log(`   Paragraphs: ${suggestion.paragraphs?.length || 0}`);
        
        suggestion.paragraphs?.forEach((para, pIndex) => {
          console.log(`   📄 Paragraph ${pIndex + 1}: ${para.id} (Page ${para.pageNumber}, Order ${para.orderIndex})`);
          console.log(`      Occurrences: ${para.occurrences}`);
          console.log(`      Content preview: "${para.content.substring(0, 50)}..."`);
        });
      });

      // Assertions
      expect(suggestions).toHaveLength(2); // Should have 2 suggestions, one for each word change
      
      // Check first suggestion (שלום -> שלום עליכם)
      const shalomSuggestion = suggestions.find(s => s.originalWord === 'שלום');
      expect(shalomSuggestion).toBeDefined();
      expect(shalomSuggestion?.correctedWord).toBe('שלום עליכם');
      expect(shalomSuggestion?.paragraphs).toHaveLength(3); // Should appear in all 3 paragraphs
      
      // Check second suggestion (טוב -> מצוין)
      const tovSuggestion = suggestions.find(s => s.originalWord === 'טוב');
      expect(tovSuggestion).toBeDefined();
      expect(tovSuggestion?.correctedWord).toBe('מצוין');
      expect(tovSuggestion?.paragraphs).toHaveLength(1); // Should appear in para-2 only (para-1 has וטוב with prefix)

      // Verify that paragraphs appearing in multiple suggestions are handled correctly
      const para1InShalom = shalomSuggestion?.paragraphs?.find(p => p.id === 'para-1');
      const para2InTov = tovSuggestion?.paragraphs?.find(p => p.id === 'para-2');
      
      expect(para1InShalom).toBeDefined();
      expect(para2InTov).toBeDefined(); // טוב only appears in para-2 (para-1 has וטוב with prefix)
      
      console.log('\n✅ Test completed - checking if same paragraph appears in multiple suggestions correctly');
    });

    it('should handle Hebrew word boundary detection correctly', async () => {
      // Test with a paragraph that has potential false positive matches
      const mockBookWithBoundaryIssues = {
        ...mockBook,
        paragraphs: [
          {
            id: 'para-boundary-test',
            pageId: 'page-1',
            orderIndex: 0,
            content: 'המילה שלום נמצאת כאן, וגם שלומית וגם בשלום.',
            page: { pageNumber: 1 }
          }
        ]
      };

      (prismaService.book.findUnique as jest.Mock).mockResolvedValue(mockBookWithBoundaryIssues);
      
      // Mock the paragraph query to properly handle exclusion
      (prismaService.paragraph.findMany as jest.Mock).mockImplementation((query) => {
        const excludeId = query?.where?.id?.not;
        const filteredParagraphs = excludeId 
          ? mockBookWithBoundaryIssues.paragraphs.filter(p => p.id !== excludeId)
          : mockBookWithBoundaryIssues.paragraphs;
        return Promise.resolve(filteredParagraphs);
      });

      const wordChanges = [
        {
          originalWord: 'שלום',
          correctedWord: 'שלום עליכם',
          fixType: 'expansion' as const,
          position: 0
        }
      ];

      const suggestions = await service.findSimilarFixesInBook(
        'book-1',
        'para-excluded',
        wordChanges
      );

      console.log('\n🔍 Hebrew word boundary test:');
      console.log('📝 Original content:', mockBookWithBoundaryIssues.paragraphs[0].content);
      console.log('🎯 Looking for word: "שלום"');
      
      if (suggestions.length > 0 && suggestions[0].paragraphs && suggestions[0].paragraphs.length > 0) {
        console.log('📊 Occurrences found:', suggestions[0].paragraphs[0].occurrences);
        console.log('🔍 Should be 1 (only standalone שלום), not בשלום (has prefix) or שלומית (substring)');
        
        // The word "שלום" should only match standalone "שלום"
        // With restrictive Hebrew boundary detection: בשלום and שלומית should NOT match
        expect(suggestions[0].paragraphs[0].occurrences).toBe(1);
      }
    });
  });
});
