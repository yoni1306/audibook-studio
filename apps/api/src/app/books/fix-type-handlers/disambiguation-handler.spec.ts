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

    it('should match Hebrew word replaced with shorter English word', () => {
      // Hebrew-to-English should work even when English word is shorter
      // (length restriction only applies to Hebrew-to-Hebrew)
      const result = handler.canHandle('שלום', 'hi');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.88);
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

    it('should not match when both are Hebrew but too dissimilar', () => {
      // Words that are too different should not be considered disambiguation
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

  describe('Hebrew to Hebrew Disambiguation', () => {
    it('should detect Hebrew spelling/pronunciation disambiguation: תשע → תישע', () => {
      // תשע has unique letters: ת,ש,ע (3 unique)
      // תישע has unique letters: ת,י,ש,ע (4 unique)
      // Common letters: ת,ש,ע (3 common)
      // Similarity: 3/4 = 75%
      const result = handler.canHandle('תשע', 'תישע');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.75);
      expect(result?.reason).toBe(DisambiguationHandler.HEBREW_TO_HEBREW_REASON);
    });

    it('should detect similar Hebrew words with spelling variations', () => {
      // שמח has unique letters: ש,מ,ח (3 unique)
      // שמיח has unique letters: ש,מ,י,ח (4 unique)
      // Common letters: ש,מ,ח (3 common)
      // Similarity: 3/4 = 75%
      const result = handler.canHandle('שמח', 'שמיח');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.75);
    });

    it('should detect Hebrew words with letter substitutions', () => {
      // כתב has unique letters: כ,ת,ב (3 unique)
      // כתיב has unique letters: כ,ת,י,ב (4 unique)
      // Common letters: כ,ת,ב (3 common)
      // Similarity: 3/4 = 75%
      const result = handler.canHandle('כתב', 'כתיב');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.75);
    });

    it('should not match Hebrew words that are too different', () => {
      const result = handler.canHandle('שלום', 'ברכה');
      
      expect(result).toBeNull();
    });

    it('should not match Hebrew words with very different lengths', () => {
      const result = handler.canHandle('אב', 'אבותינו');
      
      expect(result).toBeNull();
    });

    it('should not match single Hebrew letters', () => {
      const result = handler.canHandle('א', 'ב');
      
      expect(result).toBeNull();
    });

    it('should provide debug info for Hebrew to Hebrew disambiguation', () => {
      const result = handler.canHandle('תשע', 'תישע');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.originalHasHebrew).toBe(true);
      expect(result?.debugInfo.correctedHasHebrew).toBe(true);
      expect(result?.debugInfo.originalLetters).toBe('תשע');
      expect(result?.debugInfo.correctedLetters).toBe('תישע');
    });

    it('should handle simple Hebrew word corrections', () => {
      // Simple Hebrew-to-Hebrew corrections like תשע → תישע
      // תשע has unique letters: ת,ש,ע (3 unique)
      // תישע has unique letters: ת,י,ש,ע (4 unique)
      // Common letters: ת,ש,ע (3 common)
      // Similarity: 3/4 = 75%
      const result = handler.canHandle('תשע', 'תישע');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.75);
    });

    it('should not match Hebrew words when corrected is shorter', () => {
      // Hebrew words where corrected is shorter should not match due to length restriction
      // 'שלום' has unique letters: ש,ל,ו,ם (4 unique)
      // 'שלם' has unique letters: ש,ל,ם (3 unique)
      // Common letters: ש,ל,ם (3 common)
      // Similarity: 3/4 = 75% >= 75% threshold - but corrected is shorter, so should NOT match
      const result = handler.canHandle('שלום', 'שלם');
      
      expect(result).toBeNull();
    });

    it('should not match Hebrew words with low similarity', () => {
      // Words with low similarity should not match
      const result = handler.canHandle('שלום', 'ברכה');
      
      expect(result).toBeNull();
    });

    it('should not match when Hebrew corrected word is shorter than original', () => {
      // Hebrew-to-Hebrew disambiguation should not match if corrected word is shorter
      const result = handler.canHandle('שלום', 'שלם');
      
      expect(result).toBeNull();
    });

    it('should not match Hebrew words with very different lengths', () => {
      // Words with length difference > 2 should not match
      const result = handler.canHandle('אב', 'אבגדה');
      
      expect(result).toBeNull();
    });

    it('should not match single Hebrew letters', () => {
      // Single letters should not be considered for disambiguation
      const result = handler.canHandle('א', 'ב');
      
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

    it('should match key Hebrew-to-Hebrew disambiguation case (תשע → תישע)', () => {
      // Key test case: תשע → תישע should be classified as disambiguation
      // תשע has unique letters: ת,ש,ע (3 unique)
      // תישע has unique letters: ת,י,ש,ע (4 unique)
      // Common letters: ת,ש,ע (3 common)
      // Similarity: 3/4 = 75% >= 75% threshold ✓
      // Length check: corrected (4) >= original (3) ✓
      const result = handler.canHandle('תשע', 'תישע');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.disambiguation);
      expect(result?.confidence).toBe(0.75);
      expect(result?.reason).toBe(DisambiguationHandler.HEBREW_TO_HEBREW_REASON);
    });
  });
});
