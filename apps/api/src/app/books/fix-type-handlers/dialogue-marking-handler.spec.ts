import { DialogueMarkingHandler } from './dialogue-marking-handler';
import { FixType } from '@prisma/client';

describe('DialogueMarkingHandler', () => {
  let handler: DialogueMarkingHandler;

  beforeEach(() => {
    handler = new DialogueMarkingHandler();
  });

  describe('Adding Quotation Marks', () => {
    it('should detect addition of quotation marks with dialogue context', () => {
      const result = handler.canHandle('הוא אמר שלום', 'הוא אמר "שלום"');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Added 2 quotation mark(s)');
      expect(result?.debugInfo.hasDialogueContext).toBe(true);
    });

    it('should detect addition of Hebrew quotation marks', () => {
      const result = handler.canHandle('היא שאלה מה קורה', 'היא שאלה ״מה קורה״');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Added 2 quotation mark(s)');
    });

    it('should detect addition of single quotation marks', () => {
      const result = handler.canHandle('הוא צעק עזרה', 'הוא צעק \'עזרה\'');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.95);
    });

    it('should detect addition without explicit dialogue indicators', () => {
      const result = handler.canHandle('שלום עולם', '"שלום עולם"');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.85); // Lower confidence without context
      expect(result?.debugInfo.hasDialogueContext).toBe(false);
    });

    it('should detect multiple dialogue additions', () => {
      const result = handler.canHandle(
        'הוא אמר שלום והיא ענתה בוקר טוב',
        'הוא אמר "שלום" והיא ענתה "בוקר טוב"'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.95);
      expect(result?.debugInfo.quotesAdded).toBe(4);
    });
  });

  describe('Removing Quotation Marks', () => {
    it('should detect removal of quotation marks', () => {
      const result = handler.canHandle('הוא אמר "שלום"', 'הוא אמר שלום');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.75);
      expect(result?.reason).toContain('Removed 2 quotation mark(s)');
    });

    it('should detect removal of Hebrew quotation marks', () => {
      const result = handler.canHandle('היא שאלה ״מה קורה״', 'היא שאלה מה קורה');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.75);
    });

    it('should detect partial removal of quotation marks', () => {
      const result = handler.canHandle('"שלום" ו"בוקר טוב"', '"שלום" ובוקר טוב');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.75);
    });
  });

  describe('Changing Quotation Mark Types', () => {
    it('should detect change from English to Hebrew quotes', () => {
      const result = handler.canHandle('הוא אמר "שלום"', 'הוא אמר ״שלום״');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.90);
      expect(result?.reason).toContain('Changed to Hebrew quotation marks');
      expect(result?.debugInfo.quoteTypeChanged).toBe(true);
    });

    it('should detect change from Hebrew to English quotes', () => {
      const result = handler.canHandle('היא שאלה ״מה קורה״', 'היא שאלה "מה קורה"');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.90);
      expect(result?.reason).toContain('Changed to English quotation marks');
    });

    it('should detect change in quotation mark style', () => {
      const result = handler.canHandle('הוא אמר "שלום"', 'הוא אמר \'שלום\'');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.90);
      expect(result?.reason).toContain('Changed quotation mark style');
    });

    it('should detect mixed quotation mark changes', () => {
      const result = handler.canHandle('"שלום" ו״בוקר טוב״', '״שלום״ ו"בוקר טוב"');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.90);
    });
  });

  describe('Dialogue Structure Changes', () => {
    it('should detect addition of dialogue indicators', () => {
      const result = handler.canHandle('שלום עולם', 'הוא אמר שלום עולם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.80);
      expect(result?.reason).toContain('Restructured dialogue formatting');
      expect(result?.debugInfo.structureChanged).toBe(true);
    });

    it('should detect removal of dialogue indicators', () => {
      const result = handler.canHandle('הוא אמר שלום עולם', 'שלום עולם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.80);
    });

    it('should detect change in dialogue indicators', () => {
      const result = handler.canHandle('הוא אמר שלום', 'היא שאלה שלום');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.80);
    });
  });

  describe('Dialogue Context Detection', () => {
    it('should recognize Hebrew dialogue indicators', () => {
      const testCases = [
        'הוא אמר',
        'היא אמרה', 
        'הם שאלו',
        'היא שאלה',
        'הוא צעק',
        'היא צעקה',
        'הוא לחש',
        'היא לחשה',
        'הוא ענה',
        'היא ענתה',
        'הוא הוסיף',
        'היא הוסיפה',
        'הוא המשיך',
        'היא המשיכה'
      ];

      testCases.forEach(indicator => {
        const result = handler.canHandle(`${indicator} משהו`, `${indicator} "משהו"`);
        expect(result).not.toBeNull();
        expect(result?.confidence).toBe(0.95);
      });
    });

    it('should recognize English dialogue indicators', () => {
      const result = handler.canHandle('he said hello', 'he said "hello"');
      
      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.95);
    });

    it('should recognize dialogue punctuation patterns', () => {
      const result = handler.canHandle('שלום. אמר', '"שלום." אמר');
      
      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.95);
    });
  });

  describe('Non-Dialogue Cases', () => {
    it('should not match when no quotation changes occur', () => {
      const result = handler.canHandle('שלום עולם', 'שלום עולם');
      
      expect(result).toBeNull();
    });

    it('should not match when quotes are identical', () => {
      const result = handler.canHandle('הוא אמר "שלום"', 'הוא אמר "שלום"');
      
      expect(result).toBeNull();
    });

    it('should not match non-dialogue text changes', () => {
      const result = handler.canHandle('ספר טוב', 'ספר מעולה');
      
      expect(result).toBeNull();
    });

    it('should not match punctuation that is not quotation marks', () => {
      const result = handler.canHandle('שלום עולם', 'שלום, עולם');
      
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = handler.canHandle('', '');
      
      expect(result).toBeNull();
    });

    it('should handle mixed Hebrew-English dialogue', () => {
      const result = handler.canHandle('he said שלום', 'he said "שלום"');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
    });

    it('should handle complex dialogue with multiple speakers', () => {
      const result = handler.canHandle(
        'הוא אמר שלום והיא ענתה בוקר טוב ואז הוא הוסיף איך שלומך',
        'הוא אמר "שלום" והיא ענתה "בוקר טוב" ואז הוא הוסיף "איך שלומך"'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
      expect(result?.confidence).toBe(0.95);
    });

    it('should handle nested quotations', () => {
      const result = handler.canHandle(
        'הוא אמר היא אמרה שלום',
        'הוא אמר "היא אמרה \'שלום\'"'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.dialogue_marking);
    });
  });

  describe('Debug Information', () => {
    it('should provide detailed debug info for quote addition', () => {
      const result = handler.canHandle('הוא אמר שלום', 'הוא אמר "שלום"');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.originalQuotesCount).toBe(0);
      expect(result?.debugInfo.correctedQuotesCount).toBe(2);
      expect(result?.debugInfo.quotesAdded).toBe(2);
      expect(result?.debugInfo.hasDialogueIndicators).toBe(true);
    });

    it('should track Hebrew vs English quotes', () => {
      const result = handler.canHandle('הוא אמר "שלום"', 'הוא אמר ״שלום״');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.originalHebrewQuotes).toBe('');
      expect(result?.debugInfo.correctedHebrewQuotes).toBe('״״');
    });

    it('should provide debug info for structure changes', () => {
      const result = handler.canHandle('שלום', 'הוא אמר שלום');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.structureChanged).toBe(true);
    });
  });

  describe('Quotation Mark Pattern Coverage', () => {
    it('should detect various quotation mark types', () => {
      const quotationTypes = [
        ['"', '"'], // Standard double quotes
        ["'", "'"], // Standard single quotes
        ['"', '"'], // Curly double quotes
        ['\u2018', '\u2019'], // Curly single quotes
        ['״', '״'], // Hebrew quotes
        ['‟', '‟'], // Hebrew alternative
        ['„', '„'], // German style
        ['«', '»']  // French style
      ];

      quotationTypes.forEach(([open, close]) => {
        const result = handler.canHandle('הוא אמר שלום', `הוא אמר ${open}שלום${close}`);
        expect(result).not.toBeNull();
        expect(result?.fixType).toBe(FixType.dialogue_marking);
      });
    });
  });
});
