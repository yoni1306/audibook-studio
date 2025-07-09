/**
 * Centralized configuration for EPUB parsing parameters
 * This ensures consistent settings across all EPUB parsers and makes updates easier
 */

export interface EPUBParserConfig {
  paragraphTargetLengthChars: number;
  paragraphTargetLengthWords: number;
  pageBreakDetection: {
    includeExplicit: boolean;
    includeStructural: boolean;
    includeStylistic: boolean;
    includeSemantic: boolean;
    minConfidence: number;
  };
}

/**
 * Default EPUB parser configuration
 * Update these values to change settings across all parsers
 */
export const DEFAULT_EPUB_PARSER_CONFIG: EPUBParserConfig = {
  paragraphTargetLengthChars: 800,
  paragraphTargetLengthWords: 200,
  pageBreakDetection: {
    includeExplicit: true,
    includeStructural: true,
    includeStylistic: true,
    includeSemantic: true,
    minConfidence: 0.6,
  },
};

/**
 * Get paragraph processing configuration
 */
export function getParagraphConfig() {
  return {
    paragraphTargetLengthChars: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthChars,
    paragraphTargetLengthWords: DEFAULT_EPUB_PARSER_CONFIG.paragraphTargetLengthWords,
  };
}

/**
 * Get page break detection configuration
 */
export function getPageBreakConfig() {
  return DEFAULT_EPUB_PARSER_CONFIG.pageBreakDetection;
}
