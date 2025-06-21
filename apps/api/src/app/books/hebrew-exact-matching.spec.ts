import { Test, TestingModule } from '@nestjs/testing';
import { BulkTextFixesService } from './bulk-text-fixes.service';
import { PrismaService } from '../prisma/prisma.service';
import { TextFixesService } from './text-fixes.service';
import { Logger } from '@nestjs/common';

describe('BulkTextFixesService - Hebrew Exact Matching', () => {
  let service: BulkTextFixesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkTextFixesService,
        {
          provide: PrismaService,
          useValue: {
            paragraph: { findMany: jest.fn() },
            $transaction: jest.fn()
          }
        },
        {
          provide: TextFixesService,
          useValue: {
            analyzeTextChanges: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<BulkTextFixesService>(BulkTextFixesService);
    
    // Suppress console logs during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findHebrewWordMatches - Exact Matching', () => {
    // Access private method for testing
    const findHebrewWordMatches = (text: string, word: string) => {
      return (service as any).findHebrewWordMatches(text, word);
    };

    it('should match words with identical niqqud exactly', () => {
      const text = 'זהו סֵפֶר טוב מאוד';
      const word = 'סֵפֶר';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('סֵפֶר');
    });

    it('should NOT match word without niqqud when searching for word with niqqud', () => {
      const text = 'זהו ספר טוב מאוד';  // ספר without niqqud
      const word = 'סֵפֶר';              // סֵפֶר with niqqud
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeNull();
    });

    it('should NOT match word with niqqud when searching for word without niqqud', () => {
      const text = 'זהו סֵפֶר טוב מאוד';  // סֵפֶר with niqqud
      const word = 'ספר';                // ספר without niqqud
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeNull();
    });

    it('should match words without niqqud when both are identical', () => {
      const text = 'זהו ספר טוב מאוד';
      const word = 'ספר';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('ספר');
    });

    it('should NOT match words with different niqqud patterns', () => {
      const text = 'זהו סֵפֶר טוב מאוד';  // סֵפֶר with specific niqqud
      const word = 'סְפָר';               // סְפָר with different niqqud
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeNull();
    });

    it('should match only exact niqqud pattern among multiple variants', () => {
      const text = 'יש לי סֵפֶר אחד וגם ספר שני וגם סְפָר שלישי';
      const word = 'סֵפֶר';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('סֵפֶר');
    });

    it('should match Hebrew abbreviations exactly', () => {
      const text = 'נשיא ארה״ב ביקר בישראל';
      const word = 'ארה״ב';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('ארה״ב');
    });

    it('should NOT match similar abbreviations with different punctuation', () => {
      const text = 'נשיא ארה״ב ביקר בישראל';  // ארה״ב with gershayim
      const word = 'ארה"ב';                   // ארה"ב with regular quotes
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeNull();
    });

    it('should find all exact matches in text', () => {
      const text = 'סֵפֶר אחד, סֵפֶר שני, סֵפֶר שלישי';
      const word = 'סֵפֶר';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(3);
      expect(result.every(match => match === 'סֵפֶר')).toBe(true);
    });

    it('should find only exact matches among mixed niqqud variants', () => {
      const text = 'יש לי סֵפֶר אחד, ספר שני, סֵפֶר שלישי, וגם ספר רביעי';
      const word = 'סֵפֶר';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(2);
      expect(result.every(match => match === 'סֵפֶר')).toBe(true);
    });

    it('should NOT match partial words', () => {
      const text = 'ספריה גדולה מאוד';
      const word = 'ספר';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeNull();
    });

    it('should match word ignoring punctuation', () => {
      const text = 'שלום! איך שלומך?';
      const word = 'שלום';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('שלום');
    });

    it('should match word before various punctuation marks', () => {
      const text = 'שלום, שלום! שלום? שלום. שלום;';
      const word = 'שלום';
      
      const result = findHebrewWordMatches(text, word);
      
      expect(result).toBeTruthy();
      expect(result).toHaveLength(5);
      expect(result.every(match => match === 'שלום')).toBe(true);
    });
  });
});
