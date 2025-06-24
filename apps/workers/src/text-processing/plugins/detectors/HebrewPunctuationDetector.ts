import { BasePlugin } from '../base/BasePlugin';
import { ISplitDetector } from '../../interfaces';
import { SplitPoint, SplitPriority } from '../../types';

export class HebrewPunctuationDetector extends BasePlugin implements ISplitDetector {
  readonly name = 'HebrewPunctuationDetector';

  protected getDefaultConfig() {
    return {
      priority: SplitPriority.SENTENCE,
      // Hebrew sentence endings
      sentenceEndings: ['׃', ':', '.', '!', '?', '؟'],
      // Hebrew paragraph indicators
      paragraphIndicators: ['\n\n', '\r\n\r\n'],
      // Minimum sentence length
      minSentenceLength: 20,
      // Maximum sentence length before forced split
      maxSentenceLength: 800,
      // Hebrew quotation marks
      quotationMarks: ['"', "'", '״', '׳'],
      // Hebrew specific punctuation
      hebrewPunctuation: ['׃', '״', '׳', '־'],
    };
  }

  findSplitPoints(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    
    // Find paragraph breaks first (highest priority)
    points.push(...this.findParagraphBreaks(text));
    
    // Find sentence breaks
    points.push(...this.findSentenceBreaks(text));
    
    // Find forced breaks for very long sentences
    points.push(...this.findForcedBreaks(text));
    
    return points;
  }

  private findParagraphBreaks(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    const paragraphIndicators = this.config.paragraphIndicators as string[];
    
    for (const indicator of paragraphIndicators) {
      let index = 0;
      while ((index = text.indexOf(indicator, index)) !== -1) {
        const position = index + indicator.length;
        
        points.push({
          position,
          priority: SplitPriority.PARAGRAPH,
          marker: indicator,
          context: {
            before: text.slice(Math.max(0, index - 30), index),
            after: text.slice(position, position + 30)
          },
          metadata: {
            type: 'paragraph_break',
            indicator
          }
        });
        
        index = position;
      }
    }
    
    return points;
  }

  private findSentenceBreaks(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    const sentenceEndings = this.config.sentenceEndings as string[];
    const minLength = this.config.minSentenceLength as number;
    
    for (const ending of sentenceEndings) {
      let index = 0;
      while ((index = text.indexOf(ending, index)) !== -1) {
        const position = index + ending.length;
        
        // Check if this is a valid sentence ending
        if (this.isValidSentenceEnding(text, index, position)) {
          // Check minimum length from last split
          const lastSplitPos = this.findLastSplitPosition(points, position);
          if (position - lastSplitPos >= minLength) {
            points.push({
              position,
              priority: SplitPriority.SENTENCE,
              marker: ending,
              context: {
                before: text.slice(Math.max(0, index - 20), index),
                after: text.slice(position, position + 20)
              },
              metadata: {
                type: 'sentence_break',
                punctuation: ending
              }
            });
          }
        }
        
        index = position;
      }
    }
    
    return points;
  }

  private findForcedBreaks(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    const maxLength = this.config.maxSentenceLength as number;
    
    let lastSplitPos = 0;
    let currentPos = 0;
    
    while (currentPos < text.length) {
      if (currentPos - lastSplitPos >= maxLength) {
        // Find the best break point within the last 100 characters
        const searchStart = Math.max(lastSplitPos + maxLength - 100, currentPos - 100);
        const searchEnd = currentPos;
        
        const breakPoint = this.findBestBreakPoint(text, searchStart, searchEnd);
        if (breakPoint > lastSplitPos) {
          points.push({
            position: breakPoint,
            priority: SplitPriority.WORD,
            marker: '[FORCED_BREAK]',
            context: {
              before: text.slice(Math.max(0, breakPoint - 20), breakPoint),
              after: text.slice(breakPoint, breakPoint + 20)
            },
            metadata: {
              type: 'forced_break',
              reason: 'max_length_exceeded'
            }
          });
          
          lastSplitPos = breakPoint;
        }
      }
      currentPos++;
    }
    
    return points;
  }

  private isValidSentenceEnding(text: string, endingIndex: number, position: number): boolean {
    // Check if followed by whitespace or end of text
    if (position < text.length) {
      const nextChar = text[position];
      if (!/\s/.test(nextChar)) {
        return false;
      }
    }
    
    // Check if it's not inside quotes
    const beforeText = text.slice(0, endingIndex);
    const quotationMarks = this.config.quotationMarks as string[];
    
    for (const quote of quotationMarks) {
      const openQuotes = (beforeText.match(new RegExp(quote, 'g')) || []).length;
      if (openQuotes % 2 !== 0) {
        // Inside quotes
        return false;
      }
    }
    
    return true;
  }

  private findLastSplitPosition(points: SplitPoint[], currentPos: number): number {
    let lastPos = 0;
    for (const point of points) {
      if (point.position < currentPos && point.position > lastPos) {
        lastPos = point.position;
      }
    }
    return lastPos;
  }

  private findBestBreakPoint(text: string, start: number, end: number): number {
    // Look for whitespace, preferring spaces near Hebrew word boundaries
    for (let i = end - 1; i >= start; i--) {
      if (/\s/.test(text[i])) {
        // Check if this is a good Hebrew word boundary
        if (this.isHebrewWordBoundary(text, i)) {
          return i + 1;
        }
      }
    }
    
    // Fallback to any whitespace
    for (let i = end - 1; i >= start; i--) {
      if (/\s/.test(text[i])) {
        return i + 1;
      }
    }
    
    // Last resort: break at the end
    return end;
  }

  private isHebrewWordBoundary(text: string, position: number): boolean {
    if (position === 0 || position >= text.length - 1) return true;
    
    const before = text[position - 1];
    const after = text[position + 1];
    
    // Hebrew character range: \u0590-\u05FF
    const isHebrewBefore = /[\u0590-\u05FF]/.test(before);
    const isHebrewAfter = /[\u0590-\u05FF]/.test(after);
    
    // Good boundary if transitioning between Hebrew and non-Hebrew
    return isHebrewBefore !== isHebrewAfter;
  }
}
