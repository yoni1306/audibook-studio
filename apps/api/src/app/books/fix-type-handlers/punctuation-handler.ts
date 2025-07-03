import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';

/**
 * Handler for punctuation corrections that improve narration flow.
 * 
 * This handler detects changes that add, remove, or modify punctuation marks to improve
 * AI narration rhythm, pauses, and overall speech flow. Punctuation is crucial for
 * natural-sounding audio narration as it guides timing and intonation.
 * 
 * **Detection Rules:**
 * - Ensures base text remains identical (only punctuation changes)
 * - Detects addition of pause marks like commas, dashes, ellipses (confidence: 0.90)
 * - Detects removal of pause marks (confidence: 0.85)
 * - Detects sentence ending punctuation changes (confidence: 0.88)
 * - General punctuation modifications (confidence: 0.80)
 * 
 * **Punctuation Categories:**
 * - **Pause marks**: `,`, `-`, `–`, `—`, `…` (for narration timing)
 * - **Sentence enders**: `.`, `!`, `?` (for intonation and breaks)
 * - **General punctuation**: `'`, `"`, `()`, `[]`, `{}`, `:`, `;` (for clarity)
 * 
 * **Examples:**
 * - `שלום עולם` → `שלום, עולם` (adding pause comma)
 * - `מה קורה...` → `מה קורה?` (changing sentence ending)
 * - `ספר טוב` → `ספר "טוב"` (adding quotation marks)
 * - `כן—לא` → `כן, לא` (changing dash to comma)
 * 
 * **Use Cases:**
 * - Improving narration pacing with strategic pauses
 * - Clarifying sentence boundaries for proper intonation
 * - Adding emphasis through punctuation marks
 * - Standardizing punctuation for consistent audio flow
 */
export class PunctuationHandler extends BaseFixTypeHandler {
  readonly fixType = 'punctuation';
  readonly description = 'Adding pauses and rhythm marks (commas, dashes, ellipses) for better narration flow';
  
  // Punctuation patterns
  private readonly punctuationPattern = /[.,;:!?'"()[\]{}\-–—…]/g;
  private readonly pauseMarks = /[,\-–—…]/g;
  private readonly sentenceEnders = /[.!?]/g;
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for punctuation changes');
    
    const originalPunctuation = originalWord.match(this.punctuationPattern) || [];
    const correctedPunctuation = correctedWord.match(this.punctuationPattern) || [];
    
    // Remove all punctuation to compare base text
    const originalWithoutPunctuation = originalWord.replace(this.punctuationPattern, '');
    const correctedWithoutPunctuation = correctedWord.replace(this.punctuationPattern, '');
    
    const debugInfo = {
      originalPunctuation: originalPunctuation.join(''),
      correctedPunctuation: correctedPunctuation.join(''),
      originalPunctuationCount: originalPunctuation.length,
      correctedPunctuationCount: correctedPunctuation.length,
      baseTextChanged: originalWithoutPunctuation !== correctedWithoutPunctuation
    };
    
    // If base text changed, this is not just a punctuation fix
    if (originalWithoutPunctuation !== correctedWithoutPunctuation) {
      this.logNoMatch(originalWord, correctedWord, 'Base text changed - not purely punctuation');
      return null;
    }
    
    // Check if punctuation actually changed
    if (originalPunctuation.join('') === correctedPunctuation.join('')) {
      this.logNoMatch(originalWord, correctedWord, 'No punctuation changes detected');
      return null;
    }
    
    // Analyze the type of punctuation change
    const originalPauseMarks = originalWord.match(this.pauseMarks) || [];
    const correctedPauseMarks = correctedWord.match(this.pauseMarks) || [];
    
    if (originalPauseMarks.length < correctedPauseMarks.length) {
      const reason = `Added pause marks for better narration flow (+${correctedPauseMarks.length - originalPauseMarks.length})`;
      this.logMatch(originalWord, correctedWord, reason, 0.90);
      return {
        fixType: this.fixType,
        confidence: 0.90,
        reason,
        debugInfo: { ...debugInfo, pauseMarksAdded: correctedPauseMarks.length - originalPauseMarks.length }
      };
    }
    
    if (originalPauseMarks.length > correctedPauseMarks.length) {
      const reason = `Removed pause marks (-${originalPauseMarks.length - correctedPauseMarks.length})`;
      this.logMatch(originalWord, correctedWord, reason, 0.85);
      return {
        fixType: this.fixType,
        confidence: 0.85,
        reason,
        debugInfo: { ...debugInfo, pauseMarksRemoved: originalPauseMarks.length - correctedPauseMarks.length }
      };
    }
    
    // Check for sentence ending changes
    const originalEnders = originalWord.match(this.sentenceEnders) || [];
    const correctedEnders = correctedWord.match(this.sentenceEnders) || [];
    
    if (originalEnders.join('') !== correctedEnders.join('')) {
      const reason = 'Changed sentence ending punctuation';
      this.logMatch(originalWord, correctedWord, reason, 0.88);
      return {
        fixType: this.fixType,
        confidence: 0.88,
        reason,
        debugInfo: { ...debugInfo, sentenceEndingChanged: true }
      };
    }
    
    // General punctuation change
    const reason = 'Modified punctuation for narration improvement';
    this.logMatch(originalWord, correctedWord, reason, 0.80);
    return {
      fixType: this.fixType,
      confidence: 0.80,
      reason,
      debugInfo
    };
  }
}
