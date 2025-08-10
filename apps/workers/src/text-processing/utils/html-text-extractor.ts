// Shared HTML text extraction utility to prevent duplication from nested elements

export interface HTMLTextExtractionOptions {
  /**
   * Whether to include inline formatting elements (span, em, strong, etc.) as potential leaf elements
   * Default: true
   */
  includeInlineElements?: boolean;
  
  /**
   * Custom elements to exclude from text extraction
   * Default: ['script', 'style']
   */
  excludeElements?: string[];
}

export class HTMLTextExtractor {
  private readonly defaultOptions: Required<HTMLTextExtractionOptions> = {
    includeInlineElements: true,
    excludeElements: ['script', 'style'],
  };

  constructor(private options: HTMLTextExtractionOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Extract text chunks from HTML document, avoiding duplication from nested elements
   * Only extracts from leaf elements (elements that don't contain other major text-bearing elements)
   */
  extractTextChunks(document: Document): string[] {
    // Remove excluded elements
    this.options.excludeElements.forEach(tagName => {
      document.querySelectorAll(tagName).forEach((el) => el.remove());
    });

    const textChunks: string[] = [];
    
    // Define major text-bearing elements that should not be nested
    const majorTextElements = 'p, h1, h2, h3, h4, h5, h6, div, section, article, main, blockquote, li';
    
    // Define inline formatting elements
    const inlineElements = 'span, em, strong, b, i, u';
    
    // Find all major text-bearing elements first
    const majorElements = document.querySelectorAll(majorTextElements);
    
    // Filter to only leaf major elements (elements that don't contain other major text-bearing elements)
    const leafMajorElements: Element[] = [];
    
    majorElements.forEach((element) => {
      const hasTextBearingChildren = element.querySelector(majorTextElements);
      
      // If this element doesn't contain other major text-bearing elements, it's a leaf
      if (!hasTextBearingChildren) {
        leafMajorElements.push(element);
      }
    });
    
    // Extract text from leaf major elements
    leafMajorElements.forEach((element) => {
      const textContent = this.extractTextFromElement(element, document);
      if (textContent && textContent.trim()) {
        textChunks.push(textContent.trim());
      }
    });

    // If includeInlineElements is true, also look for standalone inline elements
    if (this.options.includeInlineElements) {
      const inlineElementsOnly = document.querySelectorAll(inlineElements);
      
      inlineElementsOnly.forEach((element) => {
        // Only include inline elements that are not nested within major text elements
        const isNestedInMajor = element.closest(majorTextElements);
        if (!isNestedInMajor) {
          const textContent = this.extractTextFromElement(element, document);
          if (textContent && textContent.trim()) {
            textChunks.push(textContent.trim());
          }
        }
      });
    }

    // If still no structured content found, try to extract all text as fallback
    if (textChunks.length === 0) {
      const bodyText = document.body?.textContent?.trim();
      if (bodyText && bodyText.trim()) {
        textChunks.push(bodyText);
      }
    }

    return textChunks;
  }

  /**
   * Extract full text from HTML document as a single string
   * Uses the same leaf element logic to avoid duplication
   */
  extractFullText(document: Document): string {
    const textChunks = this.extractTextChunks(document);
    return textChunks.join('\n\n').trim();
  }

  /**
   * Extract text content from a single HTML element
   * Uses tree walker for efficient text node traversal
   * Excludes text nodes that are descendants of anchor elements containing only reference numbers
   */
  private extractTextFromElement(element: Element, document: Document): string {
    // Create a tree walker to collect all text nodes
    const NodeFilter = document.defaultView?.NodeFilter || {
      SHOW_TEXT: 4,
      FILTER_ACCEPT: 1,
      FILTER_SKIP: 3
    };
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          const text = node.textContent?.trim();
          if (!text || text.length === 0) {
            return NodeFilter.FILTER_SKIP;
          }
          
          // Check if this text node is inside an anchor element that contains only reference numbers
          let parent = node.parentElement;
          while (parent && parent !== element) {
            if (parent.tagName.toLowerCase() === 'a') {
              // Check if the anchor contains only reference numbers or superscript elements
              if (this.isReferenceAnchor(parent)) {
                return NodeFilter.FILTER_SKIP;
              }
              break; // Found an anchor, but it's not a reference anchor, so continue
            }
            parent = parent.parentElement;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let currentText = '';
    let node;
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent?.trim();
      if (nodeText) {
        currentText += (currentText ? ' ' : '') + nodeText;
      }
    }

    return currentText.trim();
  }

  /**
   * Determines if an anchor element contains only reference numbers (like footnote markers)
   * Returns true for anchors that should be excluded from text extraction
   */
  private isReferenceAnchor(anchor: Element): boolean {
    const textContent = anchor.textContent?.trim();
    if (!textContent) {
      return true; // Empty anchors should be excluded
    }
    
    // Check if the anchor contains only superscript elements
    const supElements = anchor.querySelectorAll('sup');
    if (supElements.length > 0) {
      // If all text content comes from superscript elements, it's likely a reference
      const supText = Array.from(supElements)
        .map(sup => sup.textContent?.trim())
        .filter(text => text)
        .join('');
      
      if (supText === textContent) {
        // Check if the superscript text is just a number
        return /^\d+$/.test(textContent);
      }
    }
    
    // Check if the anchor text is just a number (even without superscript)
    if (/^\d+$/.test(textContent)) {
      return true;
    }
    
    // Keep meaningful anchor text (like chapter titles)
    return false;
  }
}
