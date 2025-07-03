import { VowelizationHandler } from './vowelization-handler';
import { FixType } from '@prisma/client';

describe('VowelizationHandler', () => {
  let handler: VowelizationHandler;

  beforeEach(() => {
    handler = new VowelizationHandler();
  });

  describe('Adding Vowel Marks', () => {
    it('should detect addition of niqqud to Hebrew text', () => {
      const result = handler.canHandle('ברא', 'בָּרָא');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Added');
      expect(result?.reason).toContain('vowel marks');
    });

    it('should detect addition of single vowel mark', () => {
      const result = handler.canHandle('שלום', 'שָׁלוֹם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Added');
    });

    it('should detect addition of multiple vowel marks', () => {
      const result = handler.canHandle('בית', 'בַּיִת');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Added');
    });

    it('should detect addition of holam and dagesh', () => {
      const result = handler.canHandle('דוב', 'דֹּב');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.95);
      expect(result?.reason).toContain('Added');
      expect(result?.reason).toContain('vowel marks');
    });
  });

  describe('Removing Vowel Marks', () => {
    it('should detect removal of niqqud from Hebrew text', () => {
      const result = handler.canHandle('בָּרָא', 'ברא');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.90);
      expect(result?.reason).toContain('Removed');
      expect(result?.reason).toContain('vowel marks');
    });

    it('should detect removal of single vowel mark', () => {
      const result = handler.canHandle('שָׁלוֹם', 'שלום');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.90);
      expect(result?.reason).toContain('Removed');
    });
  });

  describe('Changing Vowel Marks', () => {
    it('should detect modification of existing vowel marks', () => {
      const result = handler.canHandle('בְּרֵא', 'בָּרָא');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.92);
      expect(result?.reason).toContain('Changed vowel marks');
    });

    it('should detect change in number of vowel marks', () => {
      const result = handler.canHandle('שָׁלוֹם', 'שַׁלּוֹם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
      expect(result?.confidence).toBe(0.92);
      expect(result?.reason).toContain('Changed vowel marks');
    });
  });

  describe('Non-Vowelization Cases', () => {
    it('should not match when base letters are different', () => {
      const result = handler.canHandle('שלום', 'שלמה');
      
      expect(result).toBeNull();
    });

    it('should not match when words are identical', () => {
      const result = handler.canHandle('שלום', 'שלום');
      
      expect(result).toBeNull();
    });

    it('should not match when vowelized words are identical', () => {
      const result = handler.canHandle('שָׁלוֹם', 'שָׁלוֹם');
      
      expect(result).toBeNull();
    });

    it('should not match non-Hebrew text', () => {
      const result = handler.canHandle('hello', 'hello');
      
      expect(result).toBeNull();
    });

    it('should not match when only consonants change', () => {
      const result = handler.canHandle('כתב', 'כתר');
      
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = handler.canHandle('', '');
      
      expect(result).toBeNull();
    });

    it('should handle mixed Hebrew-English text', () => {
      const result = handler.canHandle('שלום world', 'שָׁלוֹם world');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should handle text with punctuation', () => {
      const result = handler.canHandle('שלום!', 'שָׁלוֹם!');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });
  });

  describe('Debug Information', () => {
    it('should provide detailed debug info', () => {
      const result = handler.canHandle('ברא', 'בָּרָא');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.originalWithoutNiqqud).toBe('ברא');
      expect(result?.debugInfo.correctedWithoutNiqqud).toBe('ברא');
      expect(result?.debugInfo.originalNiqqudCount).toBe(0);
      expect(result?.debugInfo.correctedNiqqudCount).toBeGreaterThan(0);
    });
  });

  describe('Hebrew Vowel Marks Coverage', () => {
    it('should detect sheva (ְ)', () => {
      const result = handler.canHandle('כתב', 'כְּתַב');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should detect patach (ַ)', () => {
      const result = handler.canHandle('דבר', 'דָּבָר');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should detect kamatz (ָ)', () => {
      const result = handler.canHandle('בית', 'בָּיִת');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should detect chirik (ִ)', () => {
      const result = handler.canHandle('מים', 'מַיִם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should detect tzere (ֵ)', () => {
      const result = handler.canHandle('בית', 'בֵּית');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should detect segol (ֶ)', () => {
      const result = handler.canHandle('ספר', 'סֶפֶר');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should detect cholam (ֹ)', () => {
      const result = handler.canHandle('שלום', 'שָׁלוֹם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });

    it('should detect kubutz (ֻ)', () => {
      const result = handler.canHandle('קול', 'קֻל');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.vowelization);
    });
  });
});
