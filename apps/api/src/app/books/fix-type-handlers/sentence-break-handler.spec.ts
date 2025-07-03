import { SentenceBreakHandler } from './sentence-break-handler';
import { FixType } from '@prisma/client';

describe('SentenceBreakHandler', () => {
  let handler: SentenceBreakHandler;

  beforeEach(() => {
    handler = new SentenceBreakHandler();
  });

  describe('Breaking Long Sentences', () => {
    it('should detect long sentence broken into multiple sentences', () => {
      const original = 'זה סיפור ארוך ומסובך שקשה להבין אותו בקריאה אחת ולכן צריך לחלק אותו לחלקים קטנים יותר כדי שיהיה קל יותר להבין';
      const corrected = 'זה סיפור ארוך ומסובך. קשה להבין אותו בקריאה אחת. לכן צריך לחלק אותו לחלקים קטנים יותר.';
      
      const result = handler.canHandle(original, corrected);
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.92);
      expect(result?.reason).toContain('Broke long sentence into');
      expect(result?.debugInfo.sentencesBroken).toBeGreaterThan(0);
    });

    it('should detect single sentence split into two', () => {
      const result = handler.canHandle(
        'הוא הלך לחנות וקנה לחם ואז פגש את חברו ושב הביתה',
        'הוא הלך לחנות וקנה לחם. אז פגש את חברו ושב הביתה.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.92);
      expect(result?.debugInfo.sentencesBroken).toBe(1);
    });

    it('should detect sentence split into three parts', () => {
      const result = handler.canHandle(
        'בוקר טוב, איך שלומך, מה נשמע',
        'בוקר טוב. איך שלומך? מה נשמע?'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.92);
      expect(result?.debugInfo.sentencesBroken).toBe(2);
    });
  });

  describe('Clause Restructuring', () => {
    it('should detect clause restructuring for better flow', () => {
      const result = handler.canHandle(
        'הוא הלך לחנות, קנה לחם, פגש חבר, ושב הביתה',
        'הוא הלך לחנות וקנה לחם. פגש חבר ושב הביתה.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.85);
      expect(result?.reason).toContain('Restructured sentence clauses');
      expect(result?.debugInfo.clausesRestructured).toBe(true);
    });

    it('should detect reduction in clause complexity', () => {
      const result = handler.canHandle(
        'ראשית, שנית, שלישית, ולבסוף',
        'ראשית ושנית. שלישית ולבסוף.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.85);
    });

    it('should detect structural changes in long sentences', () => {
      const original = 'הספר הזה מדבר על נושאים רבים ומגוונים כמו היסטוריה, פילוסופיה, מדע, ואמנות';
      const corrected = 'הספר הזה מדבר על נושאים רבים ומגוונים. הוא כולל היסטוריה ופילוסופיה. גם מדע ואמנות.';
      
      const result = handler.canHandle(original, corrected);
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
    });
  });

  describe('Line Break Addition', () => {
    it('should detect addition of line breaks', () => {
      const result = handler.canHandle(
        'שאלה: מה השעה? תשובה: שלוש',
        'שאלה: מה השעה?\nתשובה: שלוש'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.80);
      expect(result?.reason).toContain('Added line breaks');
      expect(result?.debugInfo.lineBreaksAdded).toBe(true);
    });

    it('should detect multiple line breaks added', () => {
      const result = handler.canHandle(
        'פרק ראשון: הקדמה פרק שני: פיתוח פרק שלישי: סיכום',
        'פרק ראשון: הקדמה\nפרק שני: פיתוח\nפרק שלישי: סיכום'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.80);
    });

    it('should detect paragraph breaks', () => {
      const result = handler.canHandle(
        'זה הפסקה הראשונה. זה הפסקה השנייה.',
        'זה הפסקה הראשונה.\n\nזה הפסקה השנייה.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
      expect(result?.confidence).toBe(0.80);
    });
  });

  describe('Non-Sentence-Break Cases', () => {
    it('should not match when no structural changes occur', () => {
      const result = handler.canHandle('שלום עולם', 'שלום עולם');
      
      expect(result).toBeNull();
    });

    it('should not match simple word changes', () => {
      const result = handler.canHandle('שלום עולם', 'שלום חברים');
      
      expect(result).toBeNull();
    });

    it('should not match when sentences are combined', () => {
      const result = handler.canHandle(
        'זה משפט ראשון. זה משפט שני.',
        'זה משפט ראשון וזה משפט שני'
      );
      
      expect(result).toBeNull();
    });

    it('should not match punctuation-only changes', () => {
      const result = handler.canHandle('שלום עולם', 'שלום, עולם');
      
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = handler.canHandle('', '');
      
      expect(result).toBeNull();
    });

    it('should handle single word', () => {
      const result = handler.canHandle('שלום', 'שלום');
      
      expect(result).toBeNull();
    });

    it('should handle text without punctuation', () => {
      const result = handler.canHandle(
        'אחד שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר',
        'אחד שתיים שלוש. ארבע חמש שש. שבע שמונה תשע עשר.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
    });

    it('should handle mixed Hebrew-English text', () => {
      const result = handler.canHandle(
        'This is Hebrew שלום and English text mixed together',
        'This is Hebrew שלום. And English text mixed together.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.fixType).toBe(FixType.sentence_break);
    });
  });

  describe('Sentence and Clause Counting', () => {
    it('should correctly count sentences with different endings', () => {
      const result = handler.canHandle(
        'שאלה ראשונה תשובה ראשונה שאלה שנייה תשובה שנייה',
        'שאלה ראשונה? תשובה ראשונה! שאלה שנייה. תשובה שנייה.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.correctedSentences).toBe(4);
    });

    it('should correctly count clauses with different separators', () => {
      const result = handler.canHandle(
        'ראשון שני שלישי רביעי',
        'ראשון, שני; שלישי: רביעי.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.correctedClauses).toBe(4);
    });
  });

  describe('Debug Information', () => {
    it('should provide detailed debug info for sentence breaks', () => {
      const original = 'זה משפט ארוך מאוד שצריך לחלק אותו לחלקים קטנים יותר';
      const corrected = 'זה משפט ארוך מאוד. צריך לחלק אותו לחלקים קטנים יותר.';
      
      const result = handler.canHandle(original, corrected);
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo).toBeDefined();
      expect(result?.debugInfo.originalSentences).toBe(1);
      expect(result?.debugInfo.correctedSentences).toBe(2);
      expect(result?.debugInfo.wasLongSentence).toBe(false); // Not over 100 chars
      expect(result?.debugInfo.sentencesBroken).toBe(1);
    });

    it('should identify long sentences correctly', () => {
      const longSentence = 'זה משפט ארוך מאוד שמכיל הרבה מילים ומושגים שונים ומגוונים שצריכים להיות מובנים ונגישים לקורא הממוצע שרוצה להבין את התוכן';
      const result = handler.canHandle(longSentence, longSentence + '.');
      
      expect(result?.debugInfo.wasLongSentence).toBe(true);
      expect(result?.debugInfo.originalLength).toBeGreaterThan(100);
    });

    it('should provide clause restructuring debug info', () => {
      const result = handler.canHandle(
        'א, ב, ג, ד, ה, ו, ז, ח, ט, י, כ, ל',
        'א ב ג ד. ה ו ז ח. ט י כ ל.'
      );
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.clausesRestructured).toBe(true);
    });

    it('should provide line break debug info', () => {
      const result = handler.canHandle(
        'שורה ראשונה שורה שנייה',
        'שורה ראשונה\nשורה שנייה'
      );
      
      expect(result).not.toBeNull();
      expect(result?.debugInfo.lineBreaksAdded).toBe(true);
    });
  });

  describe('Threshold Testing', () => {
    it('should handle sentences near the 100-character threshold', () => {
      // Exactly 100 characters
      const exactly100 = 'א'.repeat(100);
      const result1 = handler.canHandle(exactly100, exactly100 + '. ב');
      expect(result1?.debugInfo.wasLongSentence).toBe(false);
      
      // 101 characters
      const over100 = 'א'.repeat(101);
      const result2 = handler.canHandle(over100, over100 + '. ב');
      expect(result2?.debugInfo.wasLongSentence).toBe(true);
    });
  });
});
