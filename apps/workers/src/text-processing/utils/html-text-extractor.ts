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
          if (text && text.length > 0) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
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
}
