import { FixType } from '@prisma/client';
import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';

/**
 * Handler for sentence break corrections that improve narration clarity.
 * 
 * This handler detects changes that break long, complex, or nested sentences into
 * clearer, more digestible chunks for AI narration. Long sentences can be difficult
 * for listeners to follow and may cause AI narrators to lose natural pacing.
 * 
 * **Detection Rules:**
 * - Detects sentences broken into multiple sentences (confidence: 0.92)
 * - Detects clause restructuring for better flow (confidence: 0.85)
 * - Detects addition of line breaks for readability (confidence: 0.80)
 * - Uses 100-character threshold to identify long sentences
 * 
 * **Analysis Methods:**
 * - **Sentence counting**: Uses `.!?` followed by whitespace as sentence markers
 * - **Clause counting**: Uses `,;:` followed by whitespace as clause markers
 * - **Structural analysis**: Compares word count and order changes
 * - **Line break detection**: Identifies added `\n` characters
 * 
 * **Examples:**
 * - Long sentence → Multiple sentences:
 *   `זה סיפור ארוך ומסובך שקשה להבין אותו בקריאה אחת ולכן צריך לחלק אותו.`
 *   → `זה סיפור ארוך ומסובך. קשה להבין אותו בקריאה אחת. לכן צריך לחלק אותו.`
 * 
 * - Clause restructuring:
 *   `הוא הלך לחנות, קנה לחם, פגש חבר, ושב הביתה`
 *   → `הוא הלך לחנות וקנה לחם. פגש חבר ושב הביתה.`
 * 
 * - Line breaks for clarity:
 *   `שאלה: מה השעה? תשובה: שלוש`
 *   → `שאלה: מה השעה?\nתשובה: שלוש`
 * 
 * **Use Cases:**
 * - Breaking run-on sentences for better comprehension
 * - Separating complex ideas into digestible chunks
 * - Improving narration pacing and natural pauses
 * - Making dialogue and questions more distinct
 */
export class SentenceBreakHandler extends BaseFixTypeHandler {
  readonly fixType = FixType.sentence_break;
  readonly description = 'Breaking long/nested sentences into clear chunks for better narration';
  
  // Patterns for detecting sentence breaks
  private readonly sentenceBreakMarkers = /[.!?]\s+/g;
  // TODO: Semicolon support temporarily disabled - needs more specific logic
  private readonly clauseMarkers = /[,:]\s+/g;
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for sentence break changes');
    
    const originalSentences = this.countSentences(originalWord);
    const correctedSentences = this.countSentences(correctedWord);
    
    const originalClauses = this.countClauses(originalWord);
    const correctedClauses = this.countClauses(correctedWord);
    
    const hasStructuralChanges = this.hasStructuralChanges(originalWord, correctedWord);
    const hasLineBreaks = this.hasLineBreaksAdded(originalWord, correctedWord);
    const sentencesBroken = correctedSentences > originalSentences;
    const clausesChanged = correctedClauses !== originalClauses;
    
    const debugInfo = {
      originalLength: originalWord.length,
      correctedLength: correctedWord.length,
      originalSentences,
      correctedSentences,
      originalClauses,
      correctedClauses,
      sentencesBroken: sentencesBroken ? correctedSentences - originalSentences : undefined,
      clausesRestructured: (clausesChanged && hasStructuralChanges) ? true : undefined,
      lineBreaksAdded: hasLineBreaks ? true : undefined
    };
    
    // Priority 1: Check if clauses were restructured for better flow (higher priority than sentence breaks)
    // This includes cases where sentences are broken AND clauses are restructured
    if (clausesChanged && hasStructuralChanges) {
      const reason = `Restructured sentence clauses for better flow (${originalClauses} → ${correctedClauses})`;
      this.logMatch(originalWord, correctedWord, reason, 0.85);
      return {
        fixType: this.fixType,
        confidence: 0.85,
        reason,
        debugInfo
      };
    }
    
    // Priority 2: Check if sentences were broken up (only if no clause restructuring)
    if (sentencesBroken) {
      const reason = `Broke long sentence into ${correctedSentences} sentences (was ${originalSentences})`;
      this.logMatch(originalWord, correctedWord, reason, 0.92);
      return {
        fixType: this.fixType,
        confidence: 0.92,
        reason,
        debugInfo
      };
    }
    
    // Priority 3: Check for line breaks or paragraph breaks added
    if (hasLineBreaks) {
      const reason = 'Added line breaks to improve sentence flow';
      this.logMatch(originalWord, correctedWord, reason, 0.80);
      return {
        fixType: this.fixType,
        confidence: 0.80,
        reason,
        debugInfo
      };
    }
    
    this.logNoMatch(originalWord, correctedWord, 'No sentence break pattern detected');
    return null;
  }
  
  private countSentences(text: string): number {
    if (!text.trim()) return 0;
    
    // Count sentence markers followed by whitespace
    const sentencesWithWhitespace = (text.match(this.sentenceBreakMarkers) || []).length;
    
    // Check if text ends with a sentence marker (without requiring trailing whitespace)
    const endsWithSentenceMarker = /[.!?]$/.test(text.trim());
    
    // If we found sentence markers with whitespace, that's our count
    // If no markers with whitespace but ends with marker, it's 1 sentence
    // Otherwise, it's 1 sentence (unmarked)
    if (sentencesWithWhitespace > 0) {
      // Add 1 if the text ends with a sentence marker (final sentence)
      return endsWithSentenceMarker ? sentencesWithWhitespace + 1 : sentencesWithWhitespace;
    } else {
      // No internal sentence breaks, so it's 1 sentence
      return 1;
    }
  }
  
  private countClauses(text: string): number {
    const clauses = text.match(this.clauseMarkers);
    return clauses ? clauses.length + 1 : 1;
  }
  
  private hasStructuralChanges(originalWord: string, correctedWord: string): boolean {
    // Check if the word order or structure changed significantly
    const originalWords = originalWord.split(/\s+/).filter(w => w.length > 0);
    const correctedWords = correctedWord.split(/\s+/).filter(w => w.length > 0);
    
    // Check for punctuation-based structural changes (clause markers added/removed)
    const originalPunctuation = (originalWord.match(/[,:.!?]/g) || []).length;
    const correctedPunctuation = (correctedWord.match(/[,:.!?]/g) || []).length;
    const punctuationDiff = Math.abs(originalPunctuation - correctedPunctuation);
    
    // Debug logging
    this.logDebug(originalWord, correctedWord, `hasStructuralChanges: orig=${originalPunctuation}, corr=${correctedPunctuation}, diff=${punctuationDiff}`);
    
    // Only consider it structural change if:
    // 1. Significant punctuation reduction (commas removed, periods added) AND
    // 2. The sentence count doesn't increase significantly (not a sentence break)
    const originalSentences = this.countSentences(originalWord);
    const correctedSentences = this.countSentences(correctedWord);
    const sentenceIncrease = correctedSentences - originalSentences;
    
    // If punctuation changes AND it's not primarily a sentence break (increase <= 1)
    if (punctuationDiff >= 2 || (punctuationDiff >= 1 && sentenceIncrease <= 1 && originalPunctuation > correctedPunctuation)) {
      this.logDebug(originalWord, correctedWord, 'Detected structural changes due to clause restructuring pattern');
      return true;
    }
    
    // If word count changed significantly, it's likely a structural change
    const wordCountDiff = Math.abs(originalWords.length - correctedWords.length);
    const result = wordCountDiff > 2 || (wordCountDiff > 0 && originalWords.length > 10);
    this.logDebug(originalWord, correctedWord, `Word count diff: ${wordCountDiff}, result: ${result}`);
    return result;
  }
  
  private hasLineBreaksAdded(originalWord: string, correctedWord: string): boolean {
    const originalLineBreaks = (originalWord.match(/\n/g) || []).length;
    const correctedLineBreaks = (correctedWord.match(/\n/g) || []).length;
    
    return correctedLineBreaks > originalLineBreaks;
  }
}
