import { FixTypeHandlerRegistry } from './fix-type-handler-registry';
import { FixType } from '@prisma/client';

describe('FixTypeHandlerRegistry', () => {
  let registry: FixTypeHandlerRegistry;

  beforeEach(() => {
    registry = new FixTypeHandlerRegistry();
  });

  describe('Handler Initialization', () => {
    it('should initialize all fix type handlers', () => {
      const handlerInfo = registry.getHandlerInfo();
      
      expect(handlerInfo).toHaveLength(6);
      expect(handlerInfo.map(h => h.fixType)).toEqual(
        expect.arrayContaining([
          FixType.vowelization,
          FixType.disambiguation,
          FixType.punctuation,
          FixType.sentence_break,
          FixType.dialogue_marking,
          FixType.expansion
        ])
      );
      // Note: FixType.default is not included in handlers as it's used as a fallback
    });

    it('should provide descriptions for all handlers', () => {
      const handlerInfo = registry.getHandlerInfo();
      
      handlerInfo.forEach(handler => {
        expect(handler.description).toBeDefined();
        expect(handler.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Single Handler Classification', () => {
    it('should classify vowelization correctly', () => {
      const result = registry.classifyCorrection('שלום', 'שָׁלוֹם');
      
      expect(result.fixType).toBe(FixType.vowelization);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.matches).toHaveLength(1);
      expect(result.debugInfo.validationPassed).toBe(true);
      expect(result.debugInfo.matchingHandlers).toBe(1);
    });

    it('should classify disambiguation correctly', () => {
      const result = registry.classifyCorrection('שלום', 'shalom');
      
      expect(result.fixType).toBe(FixType.disambiguation);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.debugInfo.validationPassed).toBe(true);
    });

    it('should classify punctuation correctly', () => {
      const result = registry.classifyCorrection('שלום', 'שלום.');
      
      expect(result.fixType).toBe(FixType.punctuation);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.debugInfo.validationPassed).toBe(true);
    });

    it('should classify sentence break correctly', () => {
      const result = registry.classifyCorrection('שלום עולם', 'שלום. עולם');
      
      // This case matches both punctuation and sentence_break, sentence_break has higher confidence
      expect(result.fixType).toBe(FixType.sentence_break);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.debugInfo.validationPassed).toBe(true);
    });

    it('should classify dialogue marking correctly', () => {
      const result = registry.classifyCorrection('הוא אמר שלום', 'הוא אמר "שלום"');
      
      // This case matches both punctuation and dialogue_marking, dialogue_marking has higher confidence
      expect(result.fixType).toBe(FixType.dialogue_marking);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.debugInfo.validationPassed).toBe(true);
    });

    it('should classify expansion correctly', () => {
      const result = registry.classifyCorrection('5', 'חמש');
      
      expect(result.fixType).toBe(FixType.expansion);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.debugInfo.validationPassed).toBe(true);
    });
  });

  describe('No Match Scenarios', () => {
    it('should handle identical words with default fix type', () => {
      const result = registry.classifyCorrection('שלום', 'שלום');
      
      expect(result.fixType).toBe(FixType.default);
      expect(result.confidence).toBe(0.1);
      expect(result.reason).toBe('No specific fix type matched, using default classification');
      expect(result.matches).toHaveLength(0);
      expect(result.debugInfo.validationPassed).toBe(true);
      expect(result.debugInfo.matchingHandlers).toBe(0);
    });

    it('should handle unclassifiable changes with default fix type', () => {
      const result = registry.classifyCorrection('abc', 'xyz');
      
      expect(result.fixType).toBe(FixType.default);
      expect(result.confidence).toBe(0.1);
      expect(result.reason).toBe('No specific fix type matched, using default classification');
      expect(result.matches).toHaveLength(0);
      expect(result.debugInfo.validationPassed).toBe(true);
    });

    it('should handle empty strings with default fix type', () => {
      const result = registry.classifyCorrection('', '');
      
      expect(result.fixType).toBe(FixType.default);
      expect(result.confidence).toBe(0.1);
      expect(result.matches).toHaveLength(0);
      expect(result.debugInfo.validationPassed).toBe(true);
    });
  });

  describe('Multiple Handler Scenarios', () => {
    it('should select highest confidence when multiple handlers match', () => {
      // This case might match both punctuation and sentence_break
      const result = registry.classifyCorrection('שלום עולם', 'שלום. עולם.');
      
      expect(result.fixType).toBeDefined();
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
      expect(result.debugInfo.validationPassed).toBe(true);
      
      if (result.matches.length > 1) {
        // Verify highest confidence was selected
        const selectedMatch = result.debugInfo.selectedMatch;
        expect(selectedMatch).toBeDefined();
        
        result.matches.forEach(match => {
          expect(match.confidence).toBeLessThanOrEqual(selectedMatch?.confidence || 0);
        });
      }
    });

    it('should handle vowelization vs disambiguation conflict', () => {
      // Edge case: Hebrew word with niqqud that could be seen as disambiguation
      const result = registry.classifyCorrection('שלום', 'שָׁלוֹם');
      
      expect(result.fixType).toBeDefined();
      expect(result.debugInfo.validationPassed).toBe(true);
      
      // Should prefer vowelization for this case
      expect(result.fixType).toBe(FixType.vowelization);
    });

    it('should provide debug info for multiple matches', () => {
      const result = registry.classifyCorrection('שלום עולם', 'שלום. עולם.');
      
      expect(result.debugInfo.totalHandlers).toBe(6);
      expect(result.debugInfo.allMatches).toEqual(result.matches);
      
      if (result.matches.length > 1) {
        expect(result.debugInfo.selectedMatch).toBeDefined();
        expect(result.debugInfo.selectedMatch?.fixType).toBe(result.fixType);
      }
    });
  });

  describe('Confidence Selection Logic', () => {
    it('should select match with highest confidence from multiple matches', () => {
      // Create a scenario that might match multiple handlers
      const result = registry.classifyCorrection('2', 'שתיים');
      
      if (result.matches.length > 1) {
        const confidences = result.matches.map(m => m.confidence);
        const maxConfidence = Math.max(...confidences);
        
        expect(result.confidence).toBe(maxConfidence);
        expect(result.debugInfo.selectedMatch?.confidence).toBe(maxConfidence);
      }
    });

    it('should maintain match order independence', () => {
      // Test the same correction multiple times to ensure consistent results
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(registry.classifyCorrection('שלום', 'שָׁלוֹם'));
      }
      
      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.fixType).toBe(firstResult.fixType);
        expect(result.confidence).toBe(firstResult.confidence);
        expect(result.matches.length).toBe(firstResult.matches.length);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long strings', () => {
      const longString = 'א'.repeat(1000);
      const result = registry.classifyCorrection(longString, longString + 'ב');
      
      expect(result).toBeDefined();
      expect(result.debugInfo.totalHandlers).toBe(6);
    });

    it('should handle special characters', () => {
      const result = registry.classifyCorrection('שלום@#$', 'שלום!@#');
      
      expect(result).toBeDefined();
      expect(result.debugInfo.totalHandlers).toBe(6);
    });

    it('should handle mixed Hebrew and English', () => {
      const result = registry.classifyCorrection('שלום world', 'שלום עולם');
      
      expect(result).toBeDefined();
      expect(result.debugInfo.totalHandlers).toBe(6);
    });

    it('should handle numbers and symbols', () => {
      const result = registry.classifyCorrection('123$', '123 דולר');
      
      expect(result).toBeDefined();
      expect(result.debugInfo.totalHandlers).toBe(6);
    });
  });

  describe('Classification Result Structure', () => {
    it('should return complete classification result structure', () => {
      const result = registry.classifyCorrection('שלום', 'שָׁלוֹם');
      
      expect(result).toHaveProperty('fixType');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('debugInfo');
      
      expect(result.debugInfo).toHaveProperty('totalHandlers');
      expect(result.debugInfo).toHaveProperty('matchingHandlers');
      expect(result.debugInfo).toHaveProperty('allMatches');
      expect(result.debugInfo).toHaveProperty('validationPassed');
    });

    it('should provide meaningful reasons for classifications', () => {
      const testCases = [
        ['שלום', 'שָׁלוֹם', FixType.vowelization],
        ['שלום', 'shalom', FixType.disambiguation],
        ['שלום', 'שלום.', FixType.punctuation],
        ['5', 'חמש', FixType.expansion]
      ];
      
      testCases.forEach(([original, corrected, expectedType]) => {
        const result = registry.classifyCorrection(original, corrected);
        
        if (result.fixType === expectedType) {
          expect(result.reason).toBeDefined();
          expect(result.reason.length).toBeGreaterThan(0);
          expect(typeof result.reason).toBe('string');
        }
      });
    });
  });

  describe('Debug Mode', () => {
    it('should enable and disable debug mode', () => {
      expect(() => registry.setDebugMode(true)).not.toThrow();
      expect(() => registry.setDebugMode(false)).not.toThrow();
    });
  });

  describe('Real-world Classification Scenarios', () => {
    it('should handle common Hebrew text corrections', () => {
      const testCases = [
        // Vowelization cases
        { original: 'בית', corrected: 'בַּיִת', expectedType: FixType.vowelization },
        { original: 'ספר', corrected: 'סֵפֶר', expectedType: FixType.vowelization },
        
        // Disambiguation cases
        { original: 'בית', corrected: 'bayit', expectedType: FixType.disambiguation },
        { original: 'שלום', corrected: 'shalom', expectedType: FixType.disambiguation },
        
        // Punctuation cases
        { original: 'שלום', corrected: 'שלום!', expectedType: FixType.punctuation },
        { original: 'מה שלומך', corrected: 'מה שלומך?', expectedType: FixType.punctuation },
        
        // Expansion cases
        { original: '10', corrected: 'עשר', expectedType: FixType.expansion },
        { original: '2', corrected: 'שתיים', expectedType: FixType.expansion },
        
        // Dialogue marking cases
        { original: 'הוא אמר שלום', corrected: 'הוא אמר "שלום"', expectedType: FixType.dialogue_marking },
        
        // Sentence break cases (note: this also matches punctuation but sentence_break has higher confidence)
        { original: 'שלום עולם', corrected: 'שלום. עולם', expectedType: FixType.sentence_break }
      ];
      
      testCases.forEach(({ original, corrected, expectedType }) => {
        const result = registry.classifyCorrection(original, corrected);
        
        expect(result.fixType).toBe(expectedType);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.debugInfo.validationPassed).toBe(true);
      });
    });

    it('should handle ambiguous cases consistently', () => {
      // Cases that might match multiple handlers
      const ambiguousCases = [
        'שלום עולם → שלום. עולם.', // Could be punctuation or sentence_break
        'הוא אמר שלום → הוא אמר "שלום."', // Could be dialogue_marking or punctuation
      ];
      
      ambiguousCases.forEach(caseDesc => {
        const [original, corrected] = caseDesc.split(' → ');
        const result = registry.classifyCorrection(original, corrected);
        
        expect(result.fixType).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.debugInfo.validationPassed).toBe(true);
        
        // Should select the highest confidence match
        if (result.matches.length > 1) {
          const maxConfidence = Math.max(...result.matches.map(m => m.confidence));
          expect(result.confidence).toBe(maxConfidence);
        }
      });
    });
  });
});
