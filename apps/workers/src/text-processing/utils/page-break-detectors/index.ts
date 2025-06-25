// Main exports
export { EPUBPageBreakDetector } from './main-detector';
export { EPUB3PageListExtractor } from './epub3-extractor';

// Individual detector exports for testing
export { ExplicitPageBreakDetector } from './explicit-detector';
export { StructuralPageBreakDetector } from './structural-detector';
export { StylisticPageBreakDetector } from './stylistic-detector';
export { SemanticPageBreakDetector } from './semantic-detector';
export { ComputedPageBreakDetector } from './computed-detector';

// Type exports
export * from './types';

// Main detection function for backward compatibility
export { detectEPUBPageBreaks } from './detection-function';
