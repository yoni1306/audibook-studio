import { DisambiguationHandler } from './disambiguation-handler';
import { FixType } from '@prisma/client';

describe('DisambiguationHandler', () => {
  let handler: DisambiguationHandler;

  beforeEach(() => {
    handler = new DisambiguationHandler();
  });

  describe('Hebrew to English Replacement', () => {
    it('should detect Hebrew word replaced with English equivalent', () => {
      const result = handler.canHandle('ספר', 'sefer');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
      expect(result?.reason).toContain(DisambiguationHandler.HEBREW_TO_ENGLISH_REASON);
    });

    it('should detect Hebrew name replaced with English name', () => {
      const result = handler.canHandle('משה', 'Moshe');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
    });

    it('should detect Hebrew term replaced with English term', () => {
      const result = handler.canHandle('בית ספר', 'school');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
    });

    it('should not match single character replacements', () => {
      const result = handler.canHandle('א', 'a');
      
      expect(result).toBeNull();
    });

    it('should not match when corrected word still has Hebrew', () => {
      const result = handler.canHandle('שלום', 'hello שלום');
      
      expect(result).toBeNull();
    });
  });

  describe('Hebrew to English Pronunciation Replacement', () => {
    it('should detect Hebrew word replaced with English pronunciation', () => {
      const result = handler.canHandle('ספר', 'sefer');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
      expect(result?.reason).toContain(DisambiguationHandler.HEBREW_TO_ENGLISH_REASON);
    });

    it('should detect Hebrew name replaced with English pronunciation', () => {
      const result = handler.canHandle('משה', 'Moshe');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
      expect(result?.reason).toContain(DisambiguationHandler.HEBREW_TO_ENGLISH_REASON);
    });

    it('should detect Hebrew phrase replaced with English pronunciation', () => {
      const result = handler.canHandle('בית ספר', 'beit sefer');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
      expect(result?.reason).toContain(DisambiguationHandler.HEBREW_TO_ENGLISH_REASON);
    });

    it('should detect Hebrew word replaced with English translation', () => {
      const result = handler.canHandle('שלום', 'hello');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
      expect(result?.reason).toContain(DisambiguationHandler.HEBREW_TO_ENGLISH_REASON);
    });

    it('should not match when original is not Hebrew', () => {
      const result = handler.canHandle('hello', 'world');
      
      expect(result).toBeNull();
    });

    it('should not match when corrected contains Hebrew', () => {
      const result = handler.canHandle('שלום', 'hello שלום');
      
      expect(result).toBeNull();
    });

    it('should not match when both are Hebrew', () => {
      const result = handler.canHandle('שלום', 'ברכה');
      
      expect(result).toBeNull();
    });

    it('should not match when both are English', () => {
      const result = handler.canHandle('hello', 'world');
      
      expect(result).toBeNull();
    });

    it('should not match numeric patterns', () => {
      const result = handler.canHandle('2', 'שתי');
      
      expect(result).toBeNull();
    });
  });

  describe('Basic Exclusions', () => {
    it('should not match numeric patterns (handled by expansion)', () => {
      const result = handler.canHandle('2', 'שתי');
      
      expect(result).toBeNull();
    });

    it('should not match words with numbers', () => {
      const result = handler.canHandle('בית 5', 'בית חמש');
      
      expect(result).toBeNull();
    });

    it('should not match identical words', () => {
      const result = handler.canHandle('שלום', 'שלום');
      
      expect(result).toBeNull();
    });

    it('should handle empty strings', () => {
      const result = handler.canHandle('', '');
      
      expect(result).toBeNull();
    });
  });

  describe('Debug Information', () => {
    it('should provide debug info for Hebrew to English replacement', () => {
      const result = handler.canHandle('ספר', 'sefer');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.originalHasHebrew).toBe(true);
      expect(result?.debugInfo.correctedHasHebrew).toBe(false);
    });

    it('should provide Hebrew letter analysis', () => {
      const result = handler.canHandle('שלום', 'hello');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.originalHasHebrew).toBe(true);
      expect(result?.debugInfo.correctedHasHebrew).toBe(false);
    });
  });
});
