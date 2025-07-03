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
  private readonly clauseMarkers = /[,;:]\s+/g;
  private readonly longSentenceThreshold = 100; // characters
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for sentence break changes');
    
    const originalSentences = this.countSentences(originalWord);
    const correctedSentences = this.countSentences(correctedWord);
    
    const originalClauses = this.countClauses(originalWord);
    const correctedClauses = this.countClauses(correctedWord);
    
    const debugInfo = {
      originalLength: originalWord.length,
      correctedLength: correctedWord.length,
      originalSentences,
      correctedSentences,
      originalClauses,
      correctedClauses,
      wasLongSentence: originalWord.length > this.longSentenceThreshold
    };
    
    // Check if sentences were broken up
    if (correctedSentences > originalSentences) {
      const reason = `Broke long sentence into ${correctedSentences} sentences (was ${originalSentences})`;
      this.logMatch(originalWord, correctedWord, reason, 0.92);
      return {
        fixType: this.fixType,
        confidence: 0.92,
        reason,
        debugInfo: { ...debugInfo, sentencesBroken: correctedSentences - originalSentences }
      };
    }
    
    // Check if clauses were restructured for better flow
    if (correctedClauses !== originalClauses && this.hasStructuralChanges(originalWord, correctedWord)) {
      const reason = `Restructured sentence clauses for better flow (${originalClauses} → ${correctedClauses})`;
      this.logMatch(originalWord, correctedWord, reason, 0.85);
      return {
        fixType: this.fixType,
        confidence: 0.85,
        reason,
        debugInfo: { ...debugInfo, clausesRestructured: true }
      };
    }
    
    // Check for line breaks or paragraph breaks added
    if (this.hasLineBreaksAdded(originalWord, correctedWord)) {
      const reason = 'Added line breaks to improve sentence flow';
      this.logMatch(originalWord, correctedWord, reason, 0.80);
      return {
        fixType: this.fixType,
        confidence: 0.80,
        reason,
        debugInfo: { ...debugInfo, lineBreaksAdded: true }
      };
    }
    
    this.logNoMatch(originalWord, correctedWord, 'No sentence break pattern detected');
    return null;
  }
  
  private countSentences(text: string): number {
    const sentences = text.match(this.sentenceBreakMarkers);
    return sentences ? sentences.length : (text.trim() ? 1 : 0);
  }
  
  private countClauses(text: string): number {
    const clauses = text.match(this.clauseMarkers);
    return clauses ? clauses.length + 1 : 1;
  }
  
  private hasStructuralChanges(originalWord: string, correctedWord: string): boolean {
    // Check if the word order or structure changed significantly
    const originalWords = originalWord.split(/\s+/).filter(w => w.length > 0);
    const correctedWords = correctedWord.split(/\s+/).filter(w => w.length > 0);
    
    // If word count changed significantly, it's likely a structural change
    const wordCountDiff = Math.abs(originalWords.length - correctedWords.length);
    return wordCountDiff > 2 || (wordCountDiff > 0 && originalWords.length > 10);
  }
  
  private hasLineBreaksAdded(originalWord: string, correctedWord: string): boolean {
    const originalLineBreaks = (originalWord.match(/\n/g) || []).length;
    const correctedLineBreaks = (correctedWord.match(/\n/g) || []).length;
    
    return correctedLineBreaks > originalLineBreaks;
  }
}
