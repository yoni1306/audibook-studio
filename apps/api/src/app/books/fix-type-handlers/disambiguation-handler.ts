import { FixType } from '@prisma/client';
import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';

/**
 * Handler for Hebrew word disambiguation corrections.
 * 
 * This handler detects Hebrew words that are replaced with English pronunciation
 * to clarify ambiguous words that could be mispronounced by AI narration systems.
 * 
 * **Examples:**
 * - `ספר` → `sefer` (Hebrew word replaced with English pronunciation)
 * - `משה` → `Moshe` (Hebrew name replaced with English pronunciation)
 * - `שלום` → `hello` (Hebrew word replaced with English translation)
 * 
 * **Detection Rule:**
 * - Original word contains Hebrew letters
 * - Corrected word is primarily English/Latin characters
 * - Excludes numeric patterns (handled by expansion handler)
 */
export class DisambiguationHandler extends BaseFixTypeHandler {
  readonly fixType = FixType.disambiguation;
  readonly description = 'Hebrew words replaced with English pronunciation for AI clarity';
  
  // Reason text constant to avoid magic strings
  static readonly HEBREW_TO_ENGLISH_REASON = 'Hebrew to English replacement';
  
  // Hebrew letter pattern
  private readonly hebrewLetterPattern = /[\u05D0-\u05EA]/g;
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for Hebrew-to-English disambiguation');
    
    // Skip identical words
    if (originalWord === correctedWord) {
      this.logNoMatch(originalWord, correctedWord, 'Words are identical');
      return null;
    }
    
    // Exclude numeric patterns - these should be handled by expansion handler
    const numberPattern = /\d+/;
    if (numberPattern.test(originalWord)) {
      this.logNoMatch(originalWord, correctedWord, 'Contains numbers - should be handled by expansion handler');
      return null;
    }
    
    // Check for Hebrew-to-English replacement
    if (this.isHebrewToEnglishReplacement(originalWord, correctedWord)) {
      const originalLetters = originalWord.match(this.hebrewLetterPattern) || [];
      const correctedLetters = correctedWord.match(this.hebrewLetterPattern) || [];
      
      const debugInfo = {
        originalLetters: originalLetters.join(''),
        correctedLetters: correctedLetters.join(''),
        originalLength: originalLetters.length,
        correctedLength: correctedLetters.length,
        originalHasHebrew: originalLetters.length > 0,
        correctedHasHebrew: correctedLetters.length > 0
      };
      
      const reason = DisambiguationHandler.HEBREW_TO_ENGLISH_REASON;
      this.logMatch(originalWord, correctedWord, reason, 0.88);
      return {
        fixType: this.fixType,
        confidence: 0.88,
        reason,
        debugInfo
      };
    }
    
    this.logNoMatch(originalWord, correctedWord, 'Not a Hebrew-to-English replacement');
    return null;
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
