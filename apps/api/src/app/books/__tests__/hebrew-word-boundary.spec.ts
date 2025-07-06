import { Test, TestingModule } from '@nestjs/testing';
import { BulkTextFixesService } from '../bulk-text-fixes.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TextCorrectionRepository } from '../text-correction.repository';
import { TextFixesService } from '../text-fixes.service';
import { FixTypeHandlerRegistry } from '../fix-type-handlers/fix-type-handler-registry';
import { Logger } from '@nestjs/common';

describe('BulkTextFixesService - Word Matching Debug Fixed', () => {
  let service: BulkTextFixesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkTextFixesService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: TextCorrectionRepository,
          useValue: {},
        },
        {
          provide: TextFixesService,
          useValue: {},
        },
        {
          provide: FixTypeHandlerRegistry,
          useValue: {
            classifyFix: jest.fn().mockReturnValue({ fixType: 'vowelization', confidence: 0.9 }),
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
  });

  describe('findWordMatches method', () => {
    it('should find Hebrew word "טוב" in paragraph content', () => {
      const content1 = 'זה פסקה ראשונה עם שלום בתוכה.';
      const content2 = 'זה פסקה נוספת עם שלום וגם עם טוב בתוכה.';
      const word = 'טוב';

      console.log('🧪 Testing Hebrew word "טוב" detection');
      console.log('📝 Content 1:', content1);
      console.log('📝 Content 2:', content2);
      console.log('🎯 Looking for word:', word);

      const matches1 = (service as any).findWordMatches(content1, word);
      const matches2 = (service as any).findWordMatches(content2, word);

      console.log('📊 Matches in content 1:', matches1?.length || 0);
      console.log('📊 Matches in content 2:', matches2?.length || 0);
      console.log('🔍 Matches 1 details:', matches1);
      console.log('🔍 Matches 2 details:', matches2);

      // Content 1 has no "טוב", content 2 has "טוב" surrounded by spaces
      expect(matches1).toEqual([]); // No "טוב" in content 1
      expect(matches2).toBeDefined();
      expect(matches2.length).toBe(1); // One "טוב" in content 2
    });

    it('should find Hebrew word "שלום" with proper boundary detection', () => {
      const content = 'המילה שלום נמצאת כאן, וגם שלומית וגם בשלום.';
      const word = 'שלום';

      console.log('🧪 Testing Hebrew word boundary detection for "שלום"');
      console.log('📝 Content:', content);
      console.log('🎯 Looking for word:', word);

      const matches = (service as any).findWordMatches(content, word);

      console.log('📊 Total matches found:', matches?.length || 0);
      console.log('🔍 Match details:', matches);

      // With restrictive default: should only match standalone "שלום", NOT "בשלום" (adjacent Hebrew ב) or "שלומית" (part of larger word)
      expect(matches).toBeDefined();
      expect(matches.length).toBe(1); // Only the standalone "שלום"
    });

    it('should test individual regex patterns', () => {
      const content = 'המילה שלום נמצאת כאן, וגם שלומית וגם בשלום.';
      const word = 'שלום';

      console.log('🧪 Testing individual regex patterns');
      console.log('📝 Content:', content);
      console.log('🎯 Word:', word);

      // Test simple regex
      const simpleRegex = new RegExp(word, 'g');
      const simpleMatches = content.match(simpleRegex);
      console.log('🔍 Simple regex matches:', simpleMatches?.length || 0, simpleMatches);

      // Test word boundary regex
      const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'g');
      const wordBoundaryMatches = content.match(wordBoundaryRegex);
      console.log('🔍 Word boundary regex matches:', wordBoundaryMatches?.length || 0, wordBoundaryMatches);

      // Test Hebrew-aware regex (what the service should use)
      const hebrewPrefixes = '[ובלכמשה]';
      // Use Unicode escape sequences for special characters
      const wordBoundaryPunctuation = '[.,;:!?()\\[\\]{}"\'\u2013\u2014\u2015\u2016\u2017\u2018\u2019\u201C\u201D]';
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = `(^|\\s|${wordBoundaryPunctuation}|${hebrewPrefixes})(${escapedWord})(?=\\s|${wordBoundaryPunctuation}|$)`;
      const hebrewRegex = new RegExp(pattern, 'gu');
      const hebrewMatches = [...content.matchAll(hebrewRegex)];
      console.log('🔍 Hebrew-aware regex pattern:', pattern);
      console.log('🔍 Hebrew-aware regex matches:', hebrewMatches.length, hebrewMatches);
    });

    it('should test the actual service findWordMatches implementation', () => {
      const content1 = 'זה טקסט עם שתי מילים שצריכות תיקון: שלום וטוב.';
      const content2 = 'זה פסקה נוספת עם שלום וגם עם טוב בתוכה.';
      
      console.log('🧪 Testing actual service implementation');
      console.log('📝 Testing both paragraphs for "טוב"');
      
      // Test "טוב" in both paragraphs
      const tovMatches1 = (service as any).findWordMatches(content1, 'טוב');
      const tovMatches2 = (service as any).findWordMatches(content2, 'טוב');
      
      console.log('📊 "טוב" matches in para-1:', tovMatches1?.length || 0);
      console.log('📊 "טוב" matches in para-2:', tovMatches2?.length || 0);
      
      // Test "שלום" in both paragraphs
      const shalomMatches1 = (service as any).findWordMatches(content1, 'שלום');
      const shalomMatches2 = (service as any).findWordMatches(content2, 'שלום');
      
      console.log('📊 "שלום" matches in para-1:', shalomMatches1?.length || 0);
      console.log('📊 "שלום" matches in para-2:', shalomMatches2?.length || 0);
      
      // With restrictive matching:
      // - "טוב" should only be found in para-2 (surrounded by spaces)
      // - "שלום" should be found in both paragraphs (surrounded by spaces/punctuation)
      expect(tovMatches1).toEqual([]); // No "טוב" in para-1
      expect(tovMatches2.length).toBe(1); // "טוב" in para-2
      expect(shalomMatches1.length).toBe(1); // "שלום" in para-1
      expect(shalomMatches2.length).toBe(1); // "שלום" in para-2
    });
  });
});
