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
  
  // Reason text constants to avoid magic strings
  static readonly HEBREW_TO_ENGLISH_REASON = 'Hebrew to English replacement';
  static readonly HEBREW_TO_HEBREW_REASON = 'Hebrew word spelling/pronunciation disambiguation';
  
  // Hebrew letter pattern
  private readonly hebrewLetterPattern = /[\u05D0-\u05EA]/g;
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for disambiguation');
    
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
    
    // Check for Hebrew-to-Hebrew disambiguation
    if (this.isHebrewToHebrewDisambiguation(originalWord, correctedWord)) {
      const originalLetters = originalWord.match(this.hebrewLetterPattern) || [];
      const correctedLetters = correctedWord.match(this.hebrewLetterPattern) || [];
      
      // Calculate similarity for confidence score
      const originalUniqueLetters = new Set(originalLetters);
      const correctedUniqueLetters = new Set(correctedLetters);
      const commonLetters = [...originalUniqueLetters].filter(letter => correctedUniqueLetters.has(letter));
      const similarity = commonLetters.length / Math.max(originalUniqueLetters.size, correctedUniqueLetters.size);
      
      const debugInfo = {
        originalLetters: originalLetters.join(''),
        correctedLetters: correctedLetters.join(''),
        originalLength: originalLetters.length,
        correctedLength: correctedLetters.length,
        originalHasHebrew: originalLetters.length > 0,
        correctedHasHebrew: correctedLetters.length > 0
      };
      
      const reason = DisambiguationHandler.HEBREW_TO_HEBREW_REASON;
      this.logMatch(originalWord, correctedWord, reason, similarity);
      return {
        fixType: this.fixType,
        confidence: similarity,
        reason,
        debugInfo
      };
    }
    
    this.logNoMatch(originalWord, correctedWord, 'Not a disambiguation case');
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
  
  /**
   * Detects when a Hebrew word is replaced with another Hebrew word for disambiguation
   * Requires high similarity (>=75%) between Hebrew words
   * 
   * @param originalWord - The original Hebrew word
   * @param correctedWord - The replacement Hebrew word
   * @returns True if this appears to be a Hebrew→Hebrew disambiguation
   */
  private isHebrewToHebrewDisambiguation(originalWord: string, correctedWord: string): boolean {
    // Both words must contain Hebrew letters
    const hasHebrewInOriginal = this.hebrewLetterPattern.test(originalWord);
    const hasHebrewInCorrected = this.hebrewLetterPattern.test(correctedWord);
    
    if (!hasHebrewInOriginal || !hasHebrewInCorrected) {
      return false;
    }
    
    // Exclude cases that are clearly other fix types:
    
    // 1. Punctuation fixes: if only difference is punctuation marks
    const originalClean = originalWord.replace(/[^\u0590-\u05FF]/g, '');
    const correctedClean = correctedWord.replace(/[^\u0590-\u05FF]/g, '');
    if (originalClean === correctedClean && originalWord !== correctedWord) {
      return false; // This is likely a punctuation fix
    }
    
    // 2. Sentence break fixes: if corrected contains sentence-ending punctuation in middle
    if (/[.!?]\s/.test(correctedWord) && !originalWord.includes('.') && !originalWord.includes('!') && !originalWord.includes('?')) {
      return false; // This is likely a sentence break fix
    }
    
    // 3. Vowelization fixes: if only difference is vowel marks (niqqud)
    const originalNoVowels = originalWord.replace(/[\u0591-\u05C7]/g, '');
    const correctedNoVowels = correctedWord.replace(/[\u0591-\u05C7]/g, '');
    if (originalNoVowels === correctedNoVowels && originalWord !== correctedWord) {
      return false; // This is likely a vowelization fix
    }
    
    // Extract Hebrew letters from both words
    const originalLetters = originalWord.match(this.hebrewLetterPattern) || [];
    const correctedLetters = correctedWord.match(this.hebrewLetterPattern) || [];
    
    // Both words should have reasonable length (at least 2 letters)
    if (originalLetters.length < 2 || correctedLetters.length < 2) {
      return false;
    }
    
    // For Hebrew-to-Hebrew disambiguation, corrected word should not be shorter than original
    if (correctedLetters.length < originalLetters.length) {
      return false;
    }
    
    // Simple length check - words should be reasonably similar in length
    const lengthDiff = Math.abs(originalLetters.length - correctedLetters.length);
    if (lengthDiff > 2) {
      return false;
    }
    
    // Calculate similarity - require high similarity (>=75%) for Hebrew-to-Hebrew disambiguation
    const originalUniqueLetters = new Set(originalLetters);
    const correctedUniqueLetters = new Set(correctedLetters);
    const commonLetters = [...originalUniqueLetters].filter(letter => correctedUniqueLetters.has(letter));
    const similarity = commonLetters.length / Math.max(originalUniqueLetters.size, correctedUniqueLetters.size);
    
    return similarity >= 0.75;
  }
}
