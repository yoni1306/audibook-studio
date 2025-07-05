import { FixType } from '@prisma/client';
import { BaseFixTypeHandler, FixTypeMatch } from './base-fix-type-handler';

export class DialogueMarkingHandler extends BaseFixTypeHandler {
  readonly fixType = FixType.dialogue_marking;
  readonly description = 'Adding quotation marks and dialogue indicators for character speech';
  
  // Dialogue patterns - expanded to include more Unicode quotation marks
  private readonly quotationMarks = /["'"'״‟„«»‘’“”]/g;
  private readonly hebrewQuotes = /[״‟]/g;
  private readonly englishQuotes = /["'"']/g;
  private readonly dialogueIndicators = /(?:אמר|אמרה|שאל|שאלה|צעק|צעקה|לחש|לחשה|ענה|ענתה|הוסיף|הוסיפה|המשיך|המשיכה)/g;
  
  canHandle(originalWord: string, correctedWord: string): FixTypeMatch | null {
    this.logDebug(originalWord, correctedWord, 'Checking for dialogue marking changes');
    
    const originalQuotes = originalWord.match(this.quotationMarks) || [];
    const correctedQuotes = correctedWord.match(this.quotationMarks) || [];
    
    const originalHebrewQuotes = originalWord.match(this.hebrewQuotes) || [];
    const correctedHebrewQuotes = correctedWord.match(this.hebrewQuotes) || [];
    
    const originalDialogueIndicators = originalWord.match(this.dialogueIndicators) || [];
    const correctedDialogueIndicators = correctedWord.match(this.dialogueIndicators) || [];
    
    const debugInfo = {
      originalQuotesCount: originalQuotes.length,
      correctedQuotesCount: correctedQuotes.length,
      originalHebrewQuotes: originalHebrewQuotes.join(''),
      correctedHebrewQuotes: correctedHebrewQuotes.join(''),
      hasDialogueIndicators: originalDialogueIndicators.length > 0 || correctedDialogueIndicators.length > 0,
      quotesAdded: correctedQuotes.length - originalQuotes.length
    };
    
    // Check if quotation marks were added
    if (correctedQuotes.length > originalQuotes.length) {
      const quotesAdded = correctedQuotes.length - originalQuotes.length;
      
      // Higher confidence if dialogue indicators are present
      const hasDialogueContext = originalDialogueIndicators.length > 0 || 
                                correctedDialogueIndicators.length > 0 ||
                                this.hasDialogueContext(originalWord, correctedWord);
      
      const confidence = hasDialogueContext ? 0.95 : 0.85;
      const reason = `Added ${quotesAdded} quotation mark(s) for dialogue marking`;
      
      this.logMatch(originalWord, correctedWord, reason, confidence);
      return {
        fixType: this.fixType,
        confidence,
        reason,
        debugInfo: { ...debugInfo, hasDialogueContext }
      };
    }
    
    // Check if quotation marks were removed (less common but possible)
    if (originalQuotes.length > correctedQuotes.length) {
      const quotesRemoved = originalQuotes.length - correctedQuotes.length;
      const reason = `Removed ${quotesRemoved} quotation mark(s)`;
      
      this.logMatch(originalWord, correctedWord, reason, 0.75);
      return {
        fixType: this.fixType,
        confidence: 0.75,
        reason,
        debugInfo
      };
    }
    
    // Check if quotation mark types were changed (e.g., English to Hebrew quotes)
    if (originalQuotes.length === correctedQuotes.length && 
        originalQuotes.join('') !== correctedQuotes.join('')) {
      
      const reason = this.getQuoteChangeReason(originalQuotes, correctedQuotes);
      this.logMatch(originalWord, correctedWord, reason, 0.90);
      return {
        fixType: this.fixType,
        confidence: 0.90,
        reason,
        debugInfo: { ...debugInfo, quoteTypeChanged: true }
      };
    }
    
    // Check for dialogue structure changes without quote changes
    if (this.hasDialogueStructureChanges(originalWord, correctedWord)) {
      const reason = 'Restructured dialogue formatting';
      this.logMatch(originalWord, correctedWord, reason, 0.80);
      return {
        fixType: this.fixType,
        confidence: 0.80,
        reason,
        debugInfo: { ...debugInfo, structureChanged: true }
      };
    }
    
    this.logNoMatch(originalWord, correctedWord, 'No dialogue marking pattern detected');
    return null;
  }
  
  private hasDialogueContext(originalWord: string, correctedWord: string): boolean {
    const combinedText = originalWord + ' ' + correctedWord;
    
    // Check for common dialogue patterns
    const dialoguePatterns = [
      /\b(?:said|asked|shouted|whispered|replied|continued|added)\b/i,
      /\b(?:אמר|אמרה|שאל|שאלה|צעק|צעקה|לחש|לחשה|ענה|ענתה)\b/,
      /[.!?]\s*["'"'״]/,
      /["'"'״]\s*[.!?]/
    ];
    
    return dialoguePatterns.some(pattern => pattern.test(combinedText));
  }
  
  private getQuoteChangeReason(originalQuotes: string[], correctedQuotes: string[]): string {
    const originalHebrew = originalQuotes.filter(q => /[״‟]/.test(q)).length;
    const correctedHebrew = correctedQuotes.filter(q => /[״‟]/.test(q)).length;
    
    if (correctedHebrew > originalHebrew) {
      return 'Changed to Hebrew quotation marks (״)';
    } else if (originalHebrew > correctedHebrew) {
      return 'Changed to English quotation marks (")';
    } else {
      return 'Changed quotation mark style';
    }
  }
  
  private hasDialogueStructureChanges(originalWord: string, correctedWord: string): boolean {
    // Check if dialogue indicators were added, removed, or modified
    const originalIndicators = originalWord.match(this.dialogueIndicators) || [];
    const correctedIndicators = correctedWord.match(this.dialogueIndicators) || [];
    
    // Check if count changed
    if (correctedIndicators.length !== originalIndicators.length) {
      return true;
    }
    
    // Check if indicators were replaced (same count but different content)
    if (originalIndicators.length > 0 && correctedIndicators.length > 0) {
      const originalSet = new Set(originalIndicators);
      const correctedSet = new Set(correctedIndicators);
      
      // If the sets are different, indicators were replaced
      return originalSet.size !== correctedSet.size || 
             ![...originalSet].every(indicator => correctedSet.has(indicator));
    }
    
    return false;
  }
}
