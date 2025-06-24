// Main exports for the text processing module
export * from './types';
export * from './interfaces';
export * from './core/HebrewTTSSplitter';
export * from './plugins/base/BasePlugin';
export * from './plugins/detectors/HebrewPunctuationDetector';
export * from './plugins/detectors/ChapterDetector';
export * from './plugins/processors/ChunkSizeOptimizer';
export * from './factory/presets';

// Convenience function for processing book text
export { processBookText } from './utils/book-processor';
