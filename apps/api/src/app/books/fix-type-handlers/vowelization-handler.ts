import { FixType } from '@prisma/client';
import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';

/**
 * Handler for vowelization corrections in Hebrew AI narration.
 * 
 * VOWELIZATION (ניקוד) - Adding vowel marks to Hebrew text for proper pronunciation
 * 
 * Purpose:
 * Hebrew text is typically written without vowel marks (niqqud), but AI narration
 * requires proper vowelization for accurate pronunciation and natural speech flow.
 * - Detects removal of vowel marks (confidence: 0.90)
 * - Detects modification of existing vowel marks (confidence: 0.92)
 * 
 * **Examples:**
 * - `ברא` → `בָּרָא` (adding vowel marks)
 * - `בָּרָא` → `ברא` (removing vowel marks)
 * - `בְּרֵא` → `בָּרָא` (changing vowel marks)
 * 
 * **Unicode Ranges:**
 * - Hebrew vowel marks: U+05B0-U+05BD, U+05BF, U+05C1-U+05C2, U+05C4-U+05C7
 */
export class VowelizationHandler extends BaseFixTypeHandler {
  readonly fixType = FixType.vowelization;
  readonly description = 'Adding/correcting Hebrew niqqud (vowel marks) for proper pronunciation';
  
  // Hebrew niqqud pattern - vowel marks (U+05B0-U+05BD, U+05BF, U+05C1-U+05C2, U+05C4-U+05C7)
  private readonly niqqudPattern = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/g;
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for vowelization changes');
    
    // Remove niqqud from both words to compare base letters
    const originalWithoutNiqqud = originalWord.replace(this.niqqudPattern, '');
    const correctedWithoutNiqqud = correctedWord.replace(this.niqqudPattern, '');
    
    const debugInfo = {
      originalWithoutNiqqud,
      correctedWithoutNiqqud,
      originalNiqqudCount: (originalWord.match(this.niqqudPattern) || []).length,
      correctedNiqqudCount: (correctedWord.match(this.niqqudPattern) || []).length
    };
    
    // If base letters are not identical, this is not a vowelization change
    if (originalWithoutNiqqud !== correctedWithoutNiqqud) {
      this.logNoMatch(originalWord, correctedWord, 'Base letters differ - not a vowelization change');
      return null;
    }
    
    const originalNiqqud = originalWord.match(this.niqqudPattern) || [];
    const correctedNiqqud = correctedWord.match(this.niqqudPattern) || [];
    
    // Check for niqqud changes
    if (originalNiqqud.length === 0 && correctedNiqqud.length > 0) {
      const reason = `Added ${correctedNiqqud.length} vowel marks`;
      this.logMatch(originalWord, correctedWord, reason, 0.95);
      return {
        fixType: this.fixType,
        confidence: 0.95,
        reason,
        debugInfo
      };
    }
    
    if (originalNiqqud.length > 0 && correctedNiqqud.length === 0) {
      const reason = `Removed ${originalNiqqud.length} vowel marks`;
      this.logMatch(originalWord, correctedWord, reason, 0.90);
      return {
        fixType: this.fixType,
        confidence: 0.90,
        reason,
        debugInfo
      };
    }
    
    if (originalNiqqud.length > 0 && correctedNiqqud.length > 0 && 
        originalNiqqud.join('') !== correctedNiqqud.join('')) {
      const reason = `Changed vowel marks (${originalNiqqud.length} → ${correctedNiqqud.length})`;
      this.logMatch(originalWord, correctedWord, reason, 0.92);
      return {
        fixType: this.fixType,
        confidence: 0.92,
        reason,
        debugInfo
      };
    }
    
    // Base letters identical but no meaningful niqqud changes
    if (originalNiqqud.join('') === correctedNiqqud.join('')) {
      this.logNoMatch(originalWord, correctedWord, 'Identical words - no vowelization change');
      return null;
    }
    
    this.logNoMatch(originalWord, correctedWord, 'No vowelization pattern detected');
    return null;
  }
}
