import { BasePlugin } from '../base/BasePlugin';
import { ISplitDetector } from '../../interfaces';
import { SplitPoint, SplitPriority } from '../../types';

interface ChapterMatch {
  index: number;
  matchedText: string;
  title: string;
}

export class ChapterDetector extends BasePlugin implements ISplitDetector {
  readonly name = 'ChapterDetector';
  
  protected getDefaultConfig() {
    return {
      patterns: [
        // Hebrew chapter patterns
        /^פרק\s+[\u05D0-\u05EA\d]+[\s.:)]*(.*)$/gm,
        /^חלק\s+[\u05D0-\u05EA\d]+[\s.:)]*(.*)$/gm,
        
        // English chapter patterns
        /^Chapter\s+(\d+|[IVXLCDM]+)[\s:]*(.*)$/gim,
        /^Part\s+(\d+|[IVXLCDM]+)[\s:]*(.*)$/gim,
        
        // Generic patterns
        /^\d+[.)]\s*(.*)$/gm,
        /^[IVXLCDM]+[.)]\s*(.*)$/gm
      ],
      contextLength: 50,
      minTitleLength: 2,
      maxTitleLength: 100
    };
  }

  findSplitPoints(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    const patterns = this.config.patterns as RegExp[];
    const contextLength = this.config.contextLength as number;
    
    for (const pattern of patterns) {
      const matches = this.findChapterMatches(text, pattern);
      
      for (const match of matches) {
        if (this.isValidChapterTitle(match.title)) {
          points.push({
            position: match.index,
            priority: SplitPriority.CHAPTER,
            marker: match.matchedText,
            context: {
              before: text.slice(Math.max(0, match.index - contextLength), match.index),
              after: text.slice(match.index, Math.min(text.length, match.index + contextLength))
            },
            metadata: {
              type: 'chapter',
              title: match.title.trim()
            }
          });
        }
      }
    }
    
    return points;
  }

  private findChapterMatches(text: string, pattern: RegExp): ChapterMatch[] {
    const matches: ChapterMatch[] = [];
    let match: RegExpExecArray | null;
    
    // Reset regex lastIndex to ensure we start from the beginning
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      const title = this.extractTitle(match);
      matches.push({
        index: match.index,
        matchedText: match[0],
        title
      });
    }
    
    return matches;
  }

  private extractTitle(match: RegExpExecArray): string {
    // Try to find the title part from the match groups
    for (let i = match.length - 1; i >= 1; i--) {
      if (match[i] && match[i].trim()) {
        return match[i].trim();
      }
    }
    
    // Fallback: extract from the full match
    const fullMatch = match[0];
    const colonIndex = fullMatch.indexOf(':');
    if (colonIndex > -1) {
      return fullMatch.slice(colonIndex + 1).trim();
    }
    
    // Extract everything after the chapter number/identifier
    const parts = fullMatch.split(/\s+/);
    return parts.slice(2).join(' ').trim();
  }

  private isValidChapterTitle(title: string): boolean {
    const minLength = this.config.minTitleLength as number;
    const maxLength = this.config.maxTitleLength as number;
    
    return title.length >= minLength && 
           title.length <= maxLength &&
           title.trim().length > 0;
  }
}
