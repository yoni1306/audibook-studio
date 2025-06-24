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
    // If we have pre-processed EPUB pages, use them
    if (this.epubPages && this.epubPages.length > 0) {
      return this.epubPages.map(page => ({
        position: page.startOffset,
        priority: this.config.priority as number,
        marker: `Page ${page.pageNumber}`,
        context: {
          before: text.slice(Math.max(0, page.startOffset - 50), page.startOffset),
          after: text.slice(page.startOffset, page.startOffset + 50)
        },
        metadata: {
          type: 'epub_page',
          pageNumber: page.pageNumber,
          sourceFile: page.sourceFile
        }
      }));
    }
    
    return this.findStructuralSplitPoints(text);
  }

  private findStructuralSplitPoints(text: string): SplitPoint[] {
    // Fallback: detect HTML-like structure in text
    const $ = cheerio.load(text);
    const blockElements = this.config.blockElements as string[];
    
    return $(blockElements.join(',')).map((index, element) => {
      const tagName = (element as any).name || (element as any).tagName;
      const isPageBreakElement = this.isPageBreakElement(tagName);
      
      if (isPageBreakElement) {
        const position = $(element).index() * 100; // Rough position estimate
        
        return {
          position: position,
          priority: this.config.priority as number,
          marker: tagName,
          context: {
            before: text.slice(Math.max(0, position - 50), position),
            after: text.slice(position, position + 50)
          },
          metadata: {
            type: 'structural_break',
            element: tagName
          }
        };
      }
    }).get();
  }

  private isPageBreakElement(element: string): boolean {
    const pageBreakSelectors = this.config.pageBreakSelectors as string[];
    return pageBreakSelectors.some(selector => 
      element.toLowerCase().includes(selector.replace('.', '').replace('[', ''))
    );
  }
}
