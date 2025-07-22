import { Test, TestingModule } from '@nestjs/testing';
import { BulkTextFixesService } from '../bulk-text-fixes.service';
import { TextCorrectionRepository } from '../text-correction.repository';
import { FixTypeHandlerRegistry } from '../fix-type-handlers/fix-type-handler-registry';
import { PrismaService } from '../../prisma/prisma.service';
import { TextFixesService } from '../text-fixes.service';
import { FixType } from '@prisma/client';

describe('BulkTextFixesService - Hebrew Word Boundary Bug', () => {
  let service: BulkTextFixesService;

  beforeEach(async () => {
    const mockHandlerRegistry = {
      getHandlers: jest.fn().mockReturnValue([]),
      classifyCorrection: jest.fn().mockReturnValue({ 
        fixType: FixType.vowelization, 
        confidence: 0.8, 
        reason: 'Test' 
      })
    };

    const mockTextCorrectionRepository = {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
    } as any;

    const mockTextFixesService = {
      fixText: jest.fn(),
      tokenizeText: jest.fn(),
    } as any;

    const mockPrismaService = {
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

  describe('Hebrew Word Boundary Detection Bug', () => {
    it('should NOT match substrings within Hebrew words', () => {
      // Test cases where substring matching should NOT occur
      const testCases = [
        {
          text: 'הילד הולך לבית הספר',
          searchWord: 'יל', // Should NOT match substring in הילד
          expectedMatches: 0,
          description: 'Should not match יל as substring in הילד'
        },
        {
          text: 'הילד ילד קטן',
          searchWord: 'ילד', // Should match standalone ילד but NOT substring in הילד
          expectedMatches: 1,
          description: 'Should match standalone ילד but not substring in הילד'
        },
        {
          text: 'בית בתים גדולים',
          searchWord: 'בית', // Should match בית but NOT substring in בתים
          expectedMatches: 1,
          description: 'Should match בית but not substring in בתים'
        },
        {
          text: 'כתב כתבים רבים',
          searchWord: 'כתב', // Should match כתב but NOT substring in כתבים
          expectedMatches: 1,
          description: 'Should match כתב but not substring in כתבים'
        },
        {
          text: 'שלום שלומי אמר',
          searchWord: 'שלום', // Should match שלום but NOT substring in שלומי
          expectedMatches: 1,
          description: 'Should match שלום but not substring in שלומי'
        },
        {
          text: 'אמיתו של דבר, מעטים מאוד האמינו כי העם הזה יצליח להגדיר בבירור את ברית הגורל שלו, כך שתמשוך די אנשים שיבססו עליה את זהותה הראשונית של המדינה כמדינת הלאום היהודית הריבונית.',
          searchWord: 'די', // Should match standalone די but NOT substring in להגדיר
          expectedMatches: 1,
          description: 'Should match standalone די but not substring in להגדיר'
        }
      ];

      testCases.forEach(({ text, searchWord, expectedMatches, description }) => {
        console.log(`\n🧪 Testing: ${description}`);
        console.log(`📝 Text: "${text}"`);
        console.log(`🔍 Searching for: "${searchWord}"`);

        // Test findWordMatches method
        const findMatches = (service as any).findWordMatches(text, searchWord);
        console.log(`📊 findWordMatches found: ${findMatches?.length || 0} matches`);
        console.log(`🔍 Matches: ${JSON.stringify(findMatches)}`);

        // Test replaceWordMatches method
        const replacedText = (service as any).replaceWordMatches(text, searchWord, `[${searchWord}]`);
        console.log(`🔄 replaceWordMatches result: "${replacedText}"`);
        
        // Count how many replacements were made
        const replacementCount = (replacedText.match(/\[.*?\]/g) || []).length;
        console.log(`📊 replaceWordMatches made: ${replacementCount} replacements`);

        // Both methods should find the same number of matches
        expect(findMatches?.length || 0).toBe(expectedMatches);
        expect(replacementCount).toBe(expectedMatches);
        
        // Verify consistency between find and replace methods
        expect(findMatches?.length || 0).toBe(replacementCount);
      });
    });

    it('should demonstrate the current bug with Hebrew character boundaries', () => {
      // This test demonstrates the current problematic behavior
      const text = 'הילד ילד קטן';
      const searchWord = 'ילד';
      
      console.log('\n🐛 Demonstrating current bug behavior:');
      console.log(`📝 Text: "${text}"`);
      console.log(`🔍 Searching for: "${searchWord}"`);

      // Current findWordMatches uses punctuation boundaries
      const findMatches = (service as any).findWordMatches(text, searchWord);
      console.log(`📊 findWordMatches found: ${findMatches?.length || 0} matches`);
      console.log(`🔍 Find matches: ${JSON.stringify(findMatches)}`);

      // Current replaceWordMatches uses Hebrew character boundaries
      const replacedText = (service as any).replaceWordMatches(text, searchWord, `[${searchWord}]`);
      console.log(`🔄 replaceWordMatches result: "${replacedText}"`);
      
      const replacementCount = (replacedText.match(/\[.*?\]/g) || []).length;
      console.log(`📊 replaceWordMatches made: ${replacementCount} replacements`);

      // This will likely show the inconsistency
      console.log(`❌ Inconsistency: find=${findMatches?.length || 0}, replace=${replacementCount}`);
      
      // Expected behavior: should find exactly 1 match (the standalone ילד)
      // Bug: might find 2 matches (including substring in הילד)
      if ((findMatches?.length || 0) !== replacementCount) {
        console.log('🚨 BUG CONFIRMED: findWordMatches and replaceWordMatches are inconsistent!');
      }
      
      if (replacementCount > 1) {
        console.log('🚨 BUG CONFIRMED: replaceWordMatches is matching substrings!');
      }
    });

    it('should demonstrate the די/דַּי substring bug in real text', () => {
      // Real-world case provided by user where די appears as substring in להגדיר
      const text = 'אמיתו של דבר, מעטים מאוד האמינו כי העם הזה יצליח להגדיר בבירור את ברית הגורל שלו, כך שתמשוך די אנשים שיבססו עליה את זהותה הראשונית של המדינה כמדינת הלאום היהודית הריבונית.';
      const searchWord = 'די';
      const correctedWord = 'דַּי';
      
      console.log('\n🐛 Real-world די/דַּי substring bug:');
      console.log(`📝 Text: "${text}"`);
      console.log(`🔍 Searching for: "${searchWord}"`);
      console.log(`🔧 Correcting to: "${correctedWord}"`);

      // Test findWordMatches
      const findMatches = (service as any).findWordMatches(text, searchWord);
      console.log(`📊 findWordMatches found: ${findMatches?.length || 0} matches`);
      console.log(`🔍 Find matches: ${JSON.stringify(findMatches)}`);

      // Test replaceWordMatches
      const replacedText = (service as any).replaceWordMatches(text, searchWord, correctedWord);
      console.log(`🔄 replaceWordMatches result: "${replacedText}"`);
      
      // Count actual replacements made
      const originalCount = (text.match(new RegExp(searchWord, 'g')) || []).length;
      const correctedCount = (replacedText.match(new RegExp(correctedWord, 'g')) || []).length;
      console.log(`📊 Original '${searchWord}' occurrences: ${originalCount}`);
      console.log(`📊 Corrected '${correctedWord}' occurrences: ${correctedCount}`);
      
      // Check if substring in להגדיר was incorrectly replaced
      const hasIncorrectReplacement = replacedText.includes('להגדַּיר') || replacedText.includes('להגדיר'.replace('די', correctedWord));
      if (hasIncorrectReplacement) {
        console.log('🚨 BUG CONFIRMED: replaceWordMatches incorrectly replaced substring in להגדיר!');
      }
      
      // Expected: only the standalone די should be replaced, not the substring in להגדיר
      const expectedReplacements = 1; // Only the standalone די in "די אנשים"
      if (correctedCount > expectedReplacements) {
        console.log(`🚨 BUG CONFIRMED: Expected ${expectedReplacements} replacement, but got ${correctedCount}!`);
      }
      
      // Verify consistency between find and replace
      if ((findMatches?.length || 0) !== correctedCount) {
        console.log(`🚨 INCONSISTENCY: findWordMatches found ${findMatches?.length || 0} matches, but replaceWordMatches made ${correctedCount} replacements!`);
      }
    });
  });
});
