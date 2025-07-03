import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';

/**
 * Handler for Hebrew word disambiguation corrections.
 * 
 * This handler detects changes that clarify ambiguous Hebrew words which could be
 * mispronounced or misunderstood by AI narration systems. Hebrew words often have
 * multiple possible pronunciations or meanings depending on context.
 * 
 * **Detection Rules:**
 * - Identifies known ambiguous Hebrew word patterns
 * - Detects addition of phonetic cues (confidence: 0.85)
 * - Detects contextual clarification markers (confidence: 0.80)
 * - Detects Hebrew spelling variations for disambiguation (confidence: 0.75)
 * 
 * **Common Ambiguous Patterns:**
 * - `ספר` can be "sefer" (book) or "safar" (counted)
 * - `עבר` can be "avar" (past) or "ever" (crossed)
 * - Words ending with `ה` that have pronunciation ambiguity
 * 
 * **Examples:**
 * - `ספר` → `ספר (sefer)` (adding phonetic clarification)
 * - `עבר` → `עבר [past]` (adding contextual brackets)
 * - `אמא` → `אימא` (spelling disambiguation)
 * 
 * **Detection Methods:**
 * - Phonetic clues: Addition of Latin characters for pronunciation
 * - Contextual markers: Parentheses, brackets, or explanatory text
 * - Spelling variations: Different Hebrew letter combinations with same meaning
 */
export class DisambiguationHandler extends BaseFixTypeHandler {
  readonly fixType = 'disambiguation';
  readonly description = 'Clarifying ambiguous Hebrew words that could be mispronounced by AI';
  
  // Hebrew letter pattern
  private readonly hebrewLetterPattern = /[\u05D0-\u05EA]/g;
  
  // Common Hebrew ambiguous word patterns (can be extended)
  private readonly ambiguousPatterns = [
    // ספר can be "sefer" (book) or "safar" (counted)
    { pattern: /^ספר$/, reason: 'ספר ambiguity (sefer/safar)' },
    // עבר can be "avar" (past) or "ever" (crossed)
    { pattern: /^עבר$/, reason: 'עבר ambiguity (avar/ever)' },
    // Words ending with ה that could be pronounced differently
    { pattern: /[\u05D0-\u05EA]+ה$/, reason: 'Final ה pronunciation ambiguity' },
  ];
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for disambiguation changes');
    
    const originalLetters = originalWord.match(this.hebrewLetterPattern) || [];
    const correctedLetters = correctedWord.match(this.hebrewLetterPattern) || [];
    
    const debugInfo = {
      originalLetters: originalLetters.join(''),
      correctedLetters: correctedLetters.join(''),
      originalLength: originalLetters.length,
      correctedLength: correctedLetters.length
    };
    
    // Check if this involves Hebrew text
    if (originalLetters.length === 0 && correctedLetters.length === 0) {
      this.logNoMatch(originalWord, correctedWord, 'No Hebrew letters detected');
      return null;
    }
    
    // Check for known ambiguous patterns
    const isOriginalAmbiguous = this.ambiguousPatterns.some(p => p.pattern.test(originalWord));
    const isCorrectedAmbiguous = this.ambiguousPatterns.some(p => p.pattern.test(correctedWord));
    
    if (isOriginalAmbiguous || isCorrectedAmbiguous) {
      // Check if the correction involves adding context or phonetic hints
      if (this.hasPhoneticClues(originalWord, correctedWord)) {
        const reason = 'Added phonetic disambiguation cues';
        this.logMatch(originalWord, correctedWord, reason, 0.85);
        return {
          fixType: this.fixType,
          confidence: 0.85,
          reason,
          debugInfo: { ...debugInfo, phoneticClues: true }
        };
      }
      
      // Check if it's a contextual clarification
      if (this.isContextualClarification(originalWord, correctedWord)) {
        const reason = 'Contextual disambiguation';
        this.logMatch(originalWord, correctedWord, reason, 0.80);
        return {
          fixType: this.fixType,
          confidence: 0.80,
          reason,
          debugInfo: { ...debugInfo, contextual: true }
        };
      }
    }
    
    // Check for Hebrew spelling variations that indicate disambiguation
    if (this.isHebrewSpellingDisambiguation(originalWord, correctedWord)) {
      const reason = 'Hebrew spelling disambiguation';
      this.logMatch(originalWord, correctedWord, reason, 0.75);
      return {
        fixType: this.fixType,
        confidence: 0.75,
        reason,
        debugInfo
      };
    }
    
    // Check for Hebrew→English word replacement (disambiguation)
    if (this.isHebrewToEnglishReplacement(originalWord, correctedWord)) {
      const reason = 'Hebrew word replaced with English equivalent for disambiguation';
      this.logMatch(originalWord, correctedWord, reason, 0.88);
      return {
        fixType: this.fixType,
        confidence: 0.88,
        reason,
        debugInfo: { ...debugInfo, hebrewToEnglish: true }
      };
    }
    
    this.logNoMatch(originalWord, correctedWord, 'No disambiguation pattern detected');
    return null;
  }
  
  private hasPhoneticClues(originalWord: string, correctedWord: string): boolean {
    // Check if corrected word has phonetic hints like Latin characters
    const hasLatinInCorrected = /[a-zA-Z]/.test(correctedWord);
    const hasLatinInOriginal = /[a-zA-Z]/.test(originalWord);
    
    return hasLatinInCorrected && !hasLatinInOriginal;
  }
  
  private isContextualClarification(originalWord: string, correctedWord: string): boolean {
    // Check if the correction adds contextual information
    // This could be parentheses, brackets, or additional explanatory text
    const hasContextMarkers = /[()[\]{}]/.test(correctedWord) && !/[()[\]{}]/.test(originalWord);
    
    return hasContextMarkers;
  }
  
  private isHebrewSpellingDisambiguation(originalWord: string, correctedWord: string): boolean {
    const originalLetters = originalWord.match(this.hebrewLetterPattern) || [];
    const correctedLetters = correctedWord.match(this.hebrewLetterPattern) || [];
    
    // Same number of Hebrew letters but different spelling (not vowelization)
    if (originalLetters.length === correctedLetters.length && 
        originalLetters.length > 0 &&
        originalLetters.join('') !== correctedLetters.join('')) {
      
      // Remove niqqud to check if base letters changed
      const niqqudPattern = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4-\u05C7]/g;
      const originalWithoutNiqqud = originalWord.replace(niqqudPattern, '');
      const correctedWithoutNiqqud = correctedWord.replace(niqqudPattern, '');
      
      return originalWithoutNiqqud !== correctedWithoutNiqqud;
    }
    
    return false;
  }
  
  /**
   * Detects when a Hebrew word is replaced with an English word for disambiguation
   * This indicates pronunciation clarification or meaning disambiguation
   * 
   * @param originalWord - The original Hebrew word
   * @param correctedWord - The replacement English word
   * @returns True if this appears to be a Hebrew→English disambiguation
   */
  private isHebrewToEnglishReplacement(originalWord: string, correctedWord: string): boolean {
    // Check if original word contains Hebrew letters
    const hasHebrewInOriginal = this.hebrewLetterPattern.test(originalWord);
    
    // Check if corrected word is primarily English/Latin characters
    const hasLatinInCorrected = /[a-zA-Z]/.test(correctedWord);
    const hasHebrewInCorrected = this.hebrewLetterPattern.test(correctedWord);
    
    // Hebrew→English replacement: original has Hebrew, corrected is primarily English
    if (hasHebrewInOriginal && hasLatinInCorrected && !hasHebrewInCorrected) {
      // Additional validation: corrected word should be reasonably sized (not just punctuation)
      const correctedLettersOnly = correctedWord.replace(/[^a-zA-Z]/g, '');
      if (correctedLettersOnly.length >= 2) {
        return true;
      }
    }
    
    return false;
  }
}
