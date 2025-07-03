import { PunctuationHandler } from './punctuation-handler';
import { FixType } from '@prisma/client';

describe('PunctuationHandler', () => {
  let handler: PunctuationHandler;

  beforeEach(() => {
    handler = new PunctuationHandler();
  });

  describe('Adding Pause Marks', () => {
    it('should detect addition of comma for pause', () => {
      const result = handler.canHandle('שלום עולם', 'שלום, עולם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.90);
      expect(result?.reason).toContain('Added pause marks');
      expect(result?.debugInfo.pauseMarksAdded).toBe(1);
    });

    it('should detect addition of dash for pause', () => {
      const result = handler.canHandle('כן לא', 'כן-לא');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.90);
      expect(result?.reason).toContain('Added pause marks');
    });

    it('should detect addition of em dash', () => {
      const result = handler.canHandle('זה טוב', 'זה—טוב');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.90);
    });

    it('should detect addition of ellipsis', () => {
      const result = handler.canHandle('אולי', 'אולי…');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.90);
    });

    it('should detect multiple pause marks added', () => {
      const result = handler.canHandle('אחד שתיים שלוש', 'אחד, שתיים, שלוש');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.90);
      expect(result?.debugInfo.pauseMarksAdded).toBe(2);
    });
  });

  describe('Removing Pause Marks', () => {
    it('should detect removal of comma', () => {
      const result = handler.canHandle('שלום, עולם', 'שלום עולם');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.85);
      expect(result?.reason).toContain('Removed pause marks');
      expect(result?.debugInfo.pauseMarksRemoved).toBe(1);
    });

    it('should detect removal of dash', () => {
      const result = handler.canHandle('כן-לא', 'כן לא');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.85);
    });

    it('should detect removal of multiple pause marks', () => {
      const result = handler.canHandle('אחד, שתיים, שלוש', 'אחד שתיים שלוש');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.85);
      expect(result?.debugInfo.pauseMarksRemoved).toBe(2);
    });
  });

  describe('Sentence Ending Changes', () => {
    it('should detect period to exclamation change', () => {
      const result = handler.canHandle('שלום.', 'שלום!');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.88);
      expect(result?.reason).toContain('Changed sentence ending punctuation');
      expect(result?.debugInfo.sentenceEndingChanged).toBe(true);
    });

    it('should detect question mark to period change', () => {
      const result = handler.canHandle('מה קורה?', 'מה קורה.');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.88);
    });

    it('should detect ellipsis to question mark change', () => {
      const result = handler.canHandle('מה קורה...', 'מה קורה?');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.88);
    });

    it('should detect addition of sentence ending', () => {
      const result = handler.canHandle('שלום', 'שלום.');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.88);
    });
  });

  describe('General Punctuation Changes', () => {
    it('should detect addition of quotation marks', () => {
      const result = handler.canHandle('ספר טוב', 'ספר "טוב"');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.80);
      expect(result?.reason).toContain('Modified punctuation for narration improvement');
    });

    it('should detect addition of parentheses', () => {
      const result = handler.canHandle('זה טוב', 'זה (טוב)');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.80);
    });

    it('should detect addition of brackets', () => {
      const result = handler.canHandle('הערה', '[הערה]');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.80);
    });

    it('should detect colon addition', () => {
      const result = handler.canHandle('כך', 'כך:');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.80);
    });

    // TODO: Re-enable when semicolon support is added back
    // it('should detect semicolon changes', () => {
    //   const result = handler.canHandle('ראשון, שני', 'ראשון; שני');
    //   
    //   expect(result).not.toBeNull();
    //   expect(result?.fixType).toBe(FixType.punctuation);
    //   expect(result?.confidence).toBe(0.80);
    // });
  });

  describe('Non-Punctuation Cases', () => {
    it('should not match when base text changes', () => {
      const result = handler.canHandle('שלום', 'שלמה');
      
      expect(result).toBeNull();
    });

    it('should not match when no punctuation changes', () => {
      const result = handler.canHandle('שלום, עולם', 'שלום, עולם');
      
      expect(result).toBeNull();
    });

    it('should not match when only text changes with same punctuation', () => {
      const result = handler.canHandle('שלום, עולם', 'בוקר, טוב');
      
      expect(result).toBeNull();
    });

    it('should not match when both text and punctuation change significantly', () => {
      const result = handler.canHandle('שלום עולם', 'בוקר טוב!');
      
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = handler.canHandle('', '');
      
      expect(result).toBeNull();
    });

    it('should handle single punctuation mark addition', () => {
      const result = handler.canHandle('', ',');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
    });

    it('should handle complex punctuation combinations', () => {
      const result = handler.canHandle('שלום עולם', 'שלום, עולם!');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
      expect(result?.confidence).toBe(0.90); // Should prioritize pause marks
    });

    it('should handle mixed Hebrew-English text', () => {
      const result = handler.canHandle('שלום world', 'שלום, world');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
    });

    it('should handle numbers with punctuation', () => {
      const result = handler.canHandle('1 2 3', '1, 2, 3');
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.punctuation);
    });
  });

  describe('Debug Information', () => {
    it('should provide detailed debug info', () => {
      const result = handler.canHandle('שלום', 'שלום!');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.originalPunctuation).toBe('');
      expect(result?.debugInfo.correctedPunctuation).toBe('!');
      expect(result?.debugInfo.originalPunctuationCount).toBe(0);
      expect(result?.debugInfo.correctedPunctuationCount).toBe(1);
      expect(result?.debugInfo.baseTextChanged).toBe(false);
    });

    it('should track pause marks changes in debug info', () => {
      const result = handler.canHandle('א ב ג', 'א, ב, ג');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.pauseMarksAdded).toBe(2);
    });

    it('should track sentence ending changes in debug info', () => {
      const result = handler.canHandle('שלום.', 'שלום!');
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.sentenceEndingChanged).toBe(true);
    });
  });

  describe('Punctuation Pattern Coverage', () => {
    // TODO: Re-enable when dash pattern support for "אב" → "א-ב" is added back
    // it('should detect various dash types', () => {
    //   // Regular dash
    //   expect(handler.canHandle('אב', 'א-ב')).not.toBeNull();
    //   // En dash
    //   expect(handler.canHandle('אב', 'א–ב')).not.toBeNull();
    //   // Em dash
    //   expect(handler.canHandle('אב', 'א—ב')).not.toBeNull();
    // });

    it('should detect various quote types', () => {
      expect(handler.canHandle('טוב', '"טוב"')).not.toBeNull();
      expect(handler.canHandle('טוב', "'טוב'")).not.toBeNull();
    });

    it('should detect various bracket types', () => {
      expect(handler.canHandle('טוב', '(טוב)')).not.toBeNull();
      expect(handler.canHandle('טוב', '[טוב]')).not.toBeNull();
      expect(handler.canHandle('טוב', '{טוב}')).not.toBeNull();
    });
  });
});
