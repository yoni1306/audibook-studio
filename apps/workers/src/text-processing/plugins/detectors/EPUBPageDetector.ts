import { BasePlugin } from '../base/BasePlugin';
import { ISplitDetector } from '../../interfaces';
import { SplitPoint, SplitPriority, EPUBPage } from '../../types';
import * as cheerio from 'cheerio';

export class EPUBPageDetector extends BasePlugin implements ISplitDetector {
  readonly name = 'EPUBPageDetector';
  
  private epubPages: EPUBPage[] = [];

  protected getDefaultConfig() {
    return {
      // Page-based splitting priority (between CHAPTER and PARAGRAPH)
      priority: SplitPriority.PARAGRAPH - 0.5,
      // Consider natural page breaks from EPUB structure
      respectPageBreaks: true,
      // CSS selectors that typically indicate page breaks
      pageBreakSelectors: [
        '.page-break',
        '[style*="page-break"]',
        'div[class*="chapter"]',
        'section',
        'article',
        'h1', 'h2', 'h3', // Headings often start new pages
      ],
      // Block elements that create natural boundaries
      blockElements: [
        'p', 'div', 'section', 'article', 'blockquote',
        'ul', 'ol', 'figure', 'aside', 'nav'
      ],
      // Target size for EPUB pages (characters)
      targetPageSize: 1000,
      maxPageSize: 2000,
      minPageSize: 300
    };
  }

  setEPUBContent(pages: EPUBPage[]): void {
    this.epubPages = pages;
  }

  findSplitPoints(text: string): SplitPoint[] {
    const points: SplitPoint[] = [];
    
    // If we have pre-processed EPUB pages, use them
    if (this.epubPages.length > 0) {
      return this.findPageBasedSplitPoints();
    }
    
    // Otherwise, try to detect page-like structures in the text
    return this.findStructuralSplitPoints(text);
  }

  private findPageBasedSplitPoints(): SplitPoint[] {
    const points: SplitPoint[] = [];
    const priority = this.config.priority as number;
    
    for (let i = 0; i < this.epubPages.length - 1; i++) {
      const page = this.epubPages[i];
      const nextPage = this.epubPages[i + 1];
      
      points.push({
        position: page.endOffset,
        priority: priority,
        marker: '[EPUB_PAGE_BREAK]',
        context: {
          before: page.content.slice(-50),
          after: nextPage.content.slice(0, 50)
        },
        metadata: {
          type: 'epub_page',
          pageNumber: page.pageNumber,
          sourceFile: page.sourceFile
        }
      });
    }
    
    return points;
  }

  private findStructuralSplitPoints(text: string): SplitPoint[] {
    // Fallback: detect HTML-like structure in text
    const points: SplitPoint[] = [];
    const htmlPattern = /<\/?(p|div|section|article|h[1-6])[^>]*>/gi;
    let match: RegExpExecArray | null;
    
    while ((match = htmlPattern.exec(text)) !== null) {
      if (this.isPageBreakElement(match[0])) {
        points.push({
          position: match.index + match[0].length,
          priority: this.config.priority as number,
          marker: match[0],
          context: {
            before: text.slice(Math.max(0, match.index - 50), match.index),
            after: text.slice(match.index + match[0].length, match.index + match[0].length + 50)
          },
          metadata: {
            type: 'structural_break',
            element: match[1]
          }
        });
      }
    }
    
    return points;
  }

  private isPageBreakElement(element: string): boolean {
    const pageBreakSelectors = this.config.pageBreakSelectors as string[];
    return pageBreakSelectors.some(selector => 
      element.toLowerCase().includes(selector.replace('.', '').replace('[', ''))
    );
  }
}
