import { BasePlugin } from '../base/BasePlugin';
import { ISplitDetector } from '../../interfaces';
import { SplitPoint, SplitPriority } from '../../types';

export class HebrewPunctuationDetector extends BasePlugin implements ISplitDetector {
  readonly name = 'HebrewPunctuationDetector';

  protected getDefaultConfig() {
    return {
      patterns: {
        [SplitPriority.SENTENCE_END]: /[׃:.!?]/g,
        [SplitPriority.SEMICOLON]: /[;]/g,
        [SplitPriority.COMMA]: /[,،]/g
      },
      contextLength: 20
    };
  }

  findSplitPoints(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    const patterns = this.config.patterns as Record<number, RegExp>;
    const contextLength = this.config.contextLength as number;
    
    for (const [priority, pattern] of Object.entries(patterns)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(text)) !== null) {
        points.push(this.createSplitPoint(
          text,
          match.index + match[0].length,
          parseInt(priority),
          match[0],
          contextLength
        ));
      }
    }
    
    return points;
  }

  private createSplitPoint(
    text: string,
    position: number,
    priority: SplitPriority,
    marker: string,
    contextLength: number
  ): SplitPoint {
    return {
      position,
      priority,
      marker,
      context: {
        before: text.slice(Math.max(0, position - contextLength), position),
        after: text.slice(position, Math.min(text.length, position + contextLength))
      }
    };
  }
}
