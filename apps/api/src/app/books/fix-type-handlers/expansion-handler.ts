import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';

/**
 * Handler for expansion corrections in Hebrew AI narration.
 * 
 * EXPANSION (הרחבה) - Converting abbreviated forms into full readable text
 * 
 * Purpose:
 * AI narration systems need full, readable text to pronounce correctly.
 * Numbers, currencies, acronyms, and abbreviations must be expanded into
 * their full spoken form for natural and accurate speech synthesis.
 * 
 * Detection Rules:
 * This handler detects and validates expansions of:
 * 
 * 1. **NUMBERS & NUMERALS**
 *    - Hebrew numerals: "5" → "חמש", "100" → "מאה"
 *    - Roman numerals: "V" → "חמש", "X" → "עשר"
 *    - Decimal numbers: "3.14" → "שלוש נקודה אחת ארבע"
 * 
 * 2. **CURRENCY & MONETARY VALUES**
 *    - Symbols: "₪" → "שקל", "$" → "דולר", "€" → "יורו"
 *    - Amounts: "5₪" → "חמישה שקלים", "$10" → "עשרה דולר"
 *    - Mixed: "3.50₪" → "שלושה שקל וחמישים אגורות"
 * 
 * 3. **ACRONYMS & ABBREVIATIONS**
 *    - Hebrew: "צה״ל" → "צבא הגנה לישראל"
 *    - English: "USA" → "ארצות הברית", "CEO" → "מנכ״ל"
 *    - Organizations: "אונ״ר" → "אונרא", "NATO" → "נאט״ו"
 * 
 * 4. **TIME & DATE FORMATS**
 *    - Time: "15:30" → "שלוש וחצי אחר הצהריים"
 *    - Dates: "1/1/2024" → "ראשון בינואר אלפיים עשרים וארבע"
 * 
 * Confidence Scoring:
 * - High (0.9): Clear number/currency expansion with proper Hebrew
 * - Medium (0.8): Acronym expansion with recognizable pattern
 * - Medium (0.7): Time/date expansion with standard format
 * - Low (0.6): Ambiguous expansions that might be other fix types
 * 
 * Examples:
 * - "5" → "חמש" (number expansion)
 * - "₪100" → "מאה שקל" (currency expansion)
 * - "צה״ל" → "צבא הגנה לישראל" (acronym expansion)
 * - "15:30" → "שלוש וחצי" (time expansion)
 * - "Dr." → "דוקטור" (title expansion)
 */
export class ExpansionHandler extends BaseFixTypeHandler {
  readonly fixType = 'expansion';
  readonly description = 'Expanding numbers, currency, and acronyms into full readable form';
  
  // Number patterns
  private readonly numberPattern = /\b\d+(?:[.,]\d+)?\b/g;
  // Hebrew numerals use specific letters with geresh (׳) or gershayim (״) marks
  private readonly hebrewNumbers = /\b[א-ת]+[׳״]\b/g;
  private readonly romanNumerals = /\b[IVXLCDM]+\b/g;
  
  // Currency patterns
  private readonly currencySymbols = /[₪$€£¥₹]/g;
  private readonly currencyWords = /\b(?:שקל|שקלים|דולר|דולרים|יורו|לירה|לירות|אגורה|אגורות)\b/g;
  
  // Acronym patterns (Hebrew and English)
  private readonly hebrewAcronyms = /\b[א-ת]{2,}(?:״|׳)\b/g;
  private readonly englishAcronyms = /\b[A-Z]{2,}\b/g;
  
  // Time and date patterns
  private readonly timePattern = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
  private readonly datePattern = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g;
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for expansion changes');
    
    const expansionAnalysis = this.analyzeExpansion(originalWord, correctedWord);
    
    if (!expansionAnalysis.hasExpansion) {
      this.logNoMatch(originalWord, correctedWord, 'No expansion pattern detected');
      return null;
    }
    
    const { expansionType, confidence, reason, debugInfo } = expansionAnalysis;
    
    this.logMatch(originalWord, correctedWord, reason, confidence);
    return {
      fixType: this.fixType,
      confidence,
      reason,
      debugInfo
    };
  }
  
  private analyzeExpansion(originalWord: string, correctedWord: string): {
    hasExpansion: boolean;
    expansionType?: string;
    confidence: number;
    reason: string;
    debugInfo: any;
  } {
    const debugInfo = {
      originalLength: originalWord.length,
      correctedLength: correctedWord.length,
      lengthIncrease: correctedWord.length - originalWord.length,
      expansionRatio: correctedWord.length / originalWord.length
    };
    
    // Check for number expansion
    const numberExpansion = this.checkNumberExpansion(originalWord, correctedWord);
    if (numberExpansion.hasExpansion) {
      return {
        hasExpansion: true,
        expansionType: 'number',
        confidence: numberExpansion.confidence,
        reason: numberExpansion.reason,
        debugInfo: { ...debugInfo, ...numberExpansion.debugInfo }
      };
    }
    
    // Check for currency expansion
    const currencyExpansion = this.checkCurrencyExpansion(originalWord, correctedWord);
    if (currencyExpansion.hasExpansion) {
      return {
        hasExpansion: true,
        expansionType: 'currency',
        confidence: currencyExpansion.confidence,
        reason: currencyExpansion.reason,
        debugInfo: { ...debugInfo, ...currencyExpansion.debugInfo }
      };
    }
    
    // Check for acronym expansion
    const acronymExpansion = this.checkAcronymExpansion(originalWord, correctedWord);
    if (acronymExpansion.hasExpansion) {
      return {
        hasExpansion: true,
        expansionType: 'acronym',
        confidence: acronymExpansion.confidence,
        reason: acronymExpansion.reason,
        debugInfo: { ...debugInfo, ...acronymExpansion.debugInfo }
      };
    }
    
    // Check for time/date expansion
    const timeExpansion = this.checkTimeExpansion(originalWord, correctedWord);
    if (timeExpansion.hasExpansion) {
      return {
        hasExpansion: true,
        expansionType: 'time',
        confidence: timeExpansion.confidence,
        reason: timeExpansion.reason,
        debugInfo: { ...debugInfo, ...timeExpansion.debugInfo }
      };
    }
    
    return {
      hasExpansion: false,
      confidence: 0,
      reason: 'No expansion detected',
      debugInfo
    };
  }
  
  private checkNumberExpansion(originalWord: string, correctedWord: string): {
    hasExpansion: boolean;
    confidence: number;
    reason: string;
    debugInfo: any;
  } {
    const originalNumbers = originalWord.match(this.numberPattern) || [];
    const correctedNumbers = correctedWord.match(this.numberPattern) || [];
    
    const originalHebrewNumbers = originalWord.match(this.hebrewNumbers) || [];
    const correctedHebrewNumbers = correctedWord.match(this.hebrewNumbers) || [];
    
    const debugInfo = {
      originalNumbers: originalNumbers.join(', '),
      correctedNumbers: correctedNumbers.join(', '),
      originalHebrewNumbers: originalHebrewNumbers.join(', '),
      correctedHebrewNumbers: correctedHebrewNumbers.join(', '),
      isOriginalNumber: originalNumbers.length > 0 || originalHebrewNumbers.length > 0,
      isCorrectedNumber: correctedNumbers.length > 0 || correctedHebrewNumbers.length > 0
    };
    
    // Simple logic: if original word is a number and corrected word is not a number, it's an expansion
    const isOriginalNumber = originalNumbers.length > 0 || originalHebrewNumbers.length > 0;
    const isCorrectedNumber = correctedNumbers.length > 0 || correctedHebrewNumbers.length > 0;
    
    if (isOriginalNumber && !isCorrectedNumber) {
      return {
        hasExpansion: true,
        confidence: 0.95,
        reason: `Expanded number '${originalWord}' to written form '${correctedWord}'`,
        debugInfo: { ...debugInfo, expandedToWords: true }
      };
    }
    
    // Check for Hebrew number expansion (Hebrew numbers to Hebrew text)
    if (originalHebrewNumbers.length > 0 && this.hasHebrewNumberExpansion(originalWord, correctedWord)) {
      return {
        hasExpansion: true,
        confidence: 0.90,
        reason: `Expanded Hebrew number notation to full form`,
        debugInfo: { ...debugInfo, hebrewNumberExpanded: true }
      };
    }
    
    return { hasExpansion: false, confidence: 0, reason: '', debugInfo };
  }
  
  private checkCurrencyExpansion(originalWord: string, correctedWord: string): {
    hasExpansion: boolean;
    confidence: number;
    reason: string;
    debugInfo: any;
  } {
    const originalCurrencySymbols = originalWord.match(this.currencySymbols) || [];
    const correctedCurrencySymbols = correctedWord.match(this.currencySymbols) || [];
    
    const originalCurrencyWords = originalWord.match(this.currencyWords) || [];
    const correctedCurrencyWords = correctedWord.match(this.currencyWords) || [];
    
    const debugInfo = {
      originalCurrencySymbols: originalCurrencySymbols.join(''),
      correctedCurrencySymbols: correctedCurrencySymbols.join(''),
      originalCurrencyWords: originalCurrencyWords.join(', '),
      correctedCurrencyWords: correctedCurrencyWords.join(', ')
    };
    
    // Check if currency symbols were expanded to words
    if (originalCurrencySymbols.length > 0 && correctedCurrencyWords.length > originalCurrencyWords.length) {
      return {
        hasExpansion: true,
        confidence: 0.92,
        reason: `Expanded currency symbol(s) ${originalCurrencySymbols.join('')} to words`,
        debugInfo: { ...debugInfo, currencyExpanded: true }
      };
    }
    
    return { hasExpansion: false, confidence: 0, reason: '', debugInfo };
  }
  
  private checkAcronymExpansion(originalWord: string, correctedWord: string): {
    hasExpansion: boolean;
    confidence: number;
    reason: string;
    debugInfo: any;
  } {
    const originalHebrewAcronyms = originalWord.match(this.hebrewAcronyms) || [];
    const originalEnglishAcronyms = originalWord.match(this.englishAcronyms) || [];
    
    const debugInfo = {
      originalHebrewAcronyms: originalHebrewAcronyms.join(', '),
      originalEnglishAcronyms: originalEnglishAcronyms.join(', '),
      expansionRatio: correctedWord.length / originalWord.length
    };
    
    // Check for Hebrew acronym expansion
    if (originalHebrewAcronyms.length > 0 && correctedWord.length > originalWord.length * 2) {
      return {
        hasExpansion: true,
        confidence: 0.88,
        reason: `Expanded Hebrew acronym(s) ${originalHebrewAcronyms.join(', ')} to full form`,
        debugInfo: { ...debugInfo, hebrewAcronymExpanded: true }
      };
    }
    
    // Check for English acronym expansion
    if (originalEnglishAcronyms.length > 0 && correctedWord.length > originalWord.length * 2) {
      return {
        hasExpansion: true,
        confidence: 0.85,
        reason: `Expanded English acronym(s) ${originalEnglishAcronyms.join(', ')} to full form`,
        debugInfo: { ...debugInfo, englishAcronymExpanded: true }
      };
    }
    
    return { hasExpansion: false, confidence: 0, reason: '', debugInfo };
  }
  
  private checkTimeExpansion(originalWord: string, correctedWord: string): {
    hasExpansion: boolean;
    confidence: number;
    reason: string;
    debugInfo: any;
  } {
    const originalTimes = originalWord.match(this.timePattern) || [];
    const originalDates = originalWord.match(this.datePattern) || [];
    
    const debugInfo = {
      originalTimes: originalTimes.join(', '),
      originalDates: originalDates.join(', ')
    };
    
    // Check for time expansion
    if (originalTimes.length > 0 && correctedWord.length > originalWord.length * 1.5) {
      return {
        hasExpansion: true,
        confidence: 0.85,
        reason: `Expanded time format ${originalTimes.join(', ')} to readable form`,
        debugInfo: { ...debugInfo, timeExpanded: true }
      };
    }
    
    // Check for date expansion
    if (originalDates.length > 0 && correctedWord.length > originalWord.length * 1.5) {
      return {
        hasExpansion: true,
        confidence: 0.85,
        reason: `Expanded date format ${originalDates.join(', ')} to readable form`,
        debugInfo: { ...debugInfo, dateExpanded: true }
      };
    }
    
    return { hasExpansion: false, confidence: 0, reason: '', debugInfo };
  }
  
  private hasHebrewNumberExpansion(originalWord: string, correctedWord: string): boolean {
    // Check if Hebrew number notation was expanded
    const hebrewNumberWords = /\b(?:ראשון|שני|שלישי|רביעי|חמישי|ששי|שביעי|שמיני|תשיעי|עשירי)\b/;
    return hebrewNumberWords.test(correctedWord) && !hebrewNumberWords.test(originalWord);
  }
}
