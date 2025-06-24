// Core classes
export { HebrewTTSSplitter } from './core/HebrewTTSSplitter';

// Types and interfaces
export * from './types';
export * from './interfaces';

// Base plugin
export { BasePlugin } from './plugins/base/BasePlugin';

// Detectors
export { EPUBPageDetector } from './plugins/detectors/EPUBPageDetector';

// Processors
export { ChunkSizeOptimizer } from './plugins/processors/ChunkSizeOptimizer';

// Utils
export { EPUBProcessor } from './utils/EPUBProcessor';

// Factory
export { createEPUBSplitter, extractTextFromEPUB } from './factory/EPUBSplitterFactory';
export type { EPUBSplitterOptions } from './factory/EPUBSplitterFactory';
