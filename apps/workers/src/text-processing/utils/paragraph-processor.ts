// Shared paragraph processing utility for consistent paragraph splitting across EPUB parsers

export interface ParagraphProcessorOptions {
  paragraphTargetLengthChars: number;
  paragraphTargetLengthWords: number;
}

export interface ProcessedParagraph {
  orderIndex: number;
  content: string;
}

export class ParagraphProcessor {
  constructor(private options: ParagraphProcessorOptions) {}

  /**
   * Process text chunks into optimally-sized paragraphs
   * Combines short chunks and splits long ones to reach target sizes
   */
  processTextChunks(textChunks: string[]): ProcessedParagraph[] {
    const paragraphs: ProcessedParagraph[] = [];
    let orderIndex = 0;
    let currentParagraph = '';
    
    for (const chunk of textChunks) {
      if (!chunk.trim()) continue;
      
      const combinedContent = currentParagraph ? `${currentParagraph} ${chunk}` : chunk;
      const combinedLength = combinedContent.length;
      const combinedWords = this.countWords(combinedContent);
      
      // If adding this chunk would exceed our targets, finalize current paragraph
      if (currentParagraph && 
          (combinedLength > this.options.paragraphTargetLengthChars || 
           combinedWords > this.options.paragraphTargetLengthWords)) {
        
        // Process current paragraph (split if needed)
        const processedParagraphs = this.extractParagraphsFromText(currentParagraph, orderIndex);
        paragraphs.push(...processedParagraphs);
        orderIndex += processedParagraphs.length;
        
        currentParagraph = chunk;
      } else {
        currentParagraph = combinedContent;
      }
    }
    
    // Handle the last paragraph
    if (currentParagraph.trim()) {
      const processedParagraphs = this.extractParagraphsFromText(currentParagraph, orderIndex);
      paragraphs.push(...processedParagraphs);
    }
    
    return paragraphs;
  }

  /**
   * Extract paragraphs from a single text block, splitting if necessary
   * Based on the proven logic from PageBasedEPUBParser
   */
  private extractParagraphsFromText(text: string, baseOrderIndex: number): ProcessedParagraph[] {
    const paragraphs: ProcessedParagraph[] = [];
    let orderIndex = baseOrderIndex;
    
    if (!text.trim()) {
      return paragraphs;
    }

    // If text is within target size, return as single paragraph
    if (this.meetsTargetSize(text)) {
      paragraphs.push({
        orderIndex: orderIndex++,
        content: text.trim()
      });
      return paragraphs;
    }

    // Split long text into multiple paragraphs
    const splitParagraphs = this.splitLongParagraphAtSentences(text);
    
    splitParagraphs.forEach((paragraphText) => {
      if (paragraphText.trim()) {
        paragraphs.push({
          orderIndex: orderIndex++,
          content: paragraphText.trim()
        });
      }
    });

    return paragraphs;
  }

  /**
   * Check if text meets target size requirements
   */
  private meetsTargetSize(text: string): boolean {
    const charCount = text.length;
    const wordCount = this.countWords(text);
    
    return charCount <= this.options.paragraphTargetLengthChars && 
           wordCount <= this.options.paragraphTargetLengthWords;
  }

  /**
   * Split long paragraph at sentence boundaries
   * Based on the proven logic from PageBasedEPUBParser
   */
  private splitLongParagraphAtSentences(text: string): string[] {
    const result: string[] = [];
    
    // Split by sentences - improved regex to handle various sentence endings
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      if (currentChunk.length === 0) {
        // First sentence in chunk
        currentChunk = trimmedSentence;
      } else {
        const combinedLength = (currentChunk + ' ' + trimmedSentence).length;
        const combinedWords = this.countWords(currentChunk + ' ' + trimmedSentence);
        
        // Check if adding this sentence would exceed our target thresholds
        const exceedsTargetChars = combinedLength > this.options.paragraphTargetLengthChars;
        const exceedsTargetWords = combinedWords > this.options.paragraphTargetLengthWords;
        
        // Only split when BOTH targets are exceeded (more aggressive approach)
        if (exceedsTargetChars && exceedsTargetWords) {
          // Save current chunk and start new one
          result.push(currentChunk);
          currentChunk = trimmedSentence;
        } else {
          currentChunk += ' ' + trimmedSentence;
        }
      }
    }
    
    // Add the last chunk
    if (currentChunk.length > 0) {
      result.push(currentChunk);
    }

    return result.length > 0 ? result : [text];
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Check if text ends with a complete sentence
   */
  private endsWithCompleteSentence(text: string): boolean {
    const trimmed = text.trim();
    return /[.!?]$/.test(trimmed);
  }
}
