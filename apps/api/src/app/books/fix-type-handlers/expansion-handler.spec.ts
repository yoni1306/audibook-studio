import { ExpansionHandler } from './expansion-handler';
import { FixType } from '@prisma/client';

describe('ExpansionHandler', () => {
  let handler: ExpansionHandler;

  beforeEach(() => {
    handler = new ExpansionHandler();
  });

  describe('Number Expansion', () => {
    it('should detect number to Hebrew word expansion', () => {
      const result = handler.canHandle('2', 'שתי');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Expanded number');
      expect(result?.reason).toContain('2');
      expect(result?.reason).toContain('שתי');
    });

    it('should detect single digit number expansion', () => {
      const result = handler.canHandle('5', 'חמש');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Expanded number');
    });

    it('should detect multi-digit number expansion', () => {
      const result = handler.canHandle('100', 'מאה');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Expanded number');
    });

    it('should detect decimal number expansion', () => {
      const result = handler.canHandle('3.5', 'שלוש וחצי');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Expanded number');
    });

    it('should not match when original is not a number', () => {
      const result = handler.canHandle('שלום', 'שלום עליכם');
      
      expect(result).toBeNull();
    });

    it('should not match when corrected word is also a number', () => {
      const result = handler.canHandle('2', '3');
      
      expect(result).toBeNull();
    });

    it('should not match when both words are non-numbers', () => {
      const result = handler.canHandle('שלום', 'שלום עליכם');
      
      expect(result).toBeNull();
    });
  });

  // TODO: Currency expansion tests disabled for now
  // describe('Currency Expansion', () => {
  //   it('should detect currency symbol expansion', () => {
  //     const result = handler.canHandle('₪', 'שקל');
  //     
  //     expect(result).not.toBeNull();
  //     expect(result!.fixType).toBe(FixType.expansion);
  //     expect(result!.confidence).toBeGreaterThan(0.9);
  //     expect(result!.reason).toContain('currency');
  //   });

  //   it('should detect currency amount expansion', () => {
  //     const result = handler.canHandle('5₪', 'חמישה שקלים');
  //     
  //     expect(result).not.toBeNull();
  //     expect(result!.fixType).toBe(FixType.expansion);
  //     expect(result!.confidence).toBeGreaterThan(0.9);
  //   });
  // });

  describe('Acronym Expansion', () => {
    it('should detect Hebrew acronym expansion', () => {
      const result = handler.canHandle('צה״ל', 'צבא הגנה לישראל');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBeGreaterThan(0.8);
      expect(result?.reason).toContain('acronym');
    });

    it('should detect English acronym expansion', () => {
      const result = handler.canHandle('USA', 'ארצות הברית');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBeGreaterThan(0.8);
      expect(result?.reason).toContain('acronym');
    });
  });

  describe('Time Expansion', () => {
    it('should detect time format expansion', () => {
      const result = handler.canHandle('15:30', 'שלוש וחצי אחר הצהריים');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBeGreaterThan(0.8);
      expect(result?.reason).toContain('time');
    });

    it('should detect date format expansion', () => {
      const result = handler.canHandle('1/1/2024', 'ראשון בינואר אלפיים עשרים וארבע');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBeGreaterThan(0.8);
      expect(result?.reason).toContain('date');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = handler.canHandle('', '');
      
      expect(result).toBeNull();
    });

    it('should handle identical words', () => {
      const result = handler.canHandle('שלום', 'שלום');
      
      expect(result).toBeNull();
    });

    it('should handle mixed Hebrew-English text', () => {
      const result = handler.canHandle('2', 'two');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.expansion);
      expect(result?.confidence).toBe(0.95);
    });
  });

  describe('Debug Information', () => {
    it('should provide detailed debug info for number expansion', () => {
      const result = handler.canHandle('2', 'שתי');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.isOriginalNumber).toBe(true);
      expect(result?.debugInfo.isCorrectedNumber).toBe(false);
      expect(result?.debugInfo.expandedToWords).toBe(true);
    });
  });
});
