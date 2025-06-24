import { HebrewTTSSplitter } from '../core/HebrewTTSSplitter';
import { HebrewPunctuationDetector } from '../plugins/detectors/HebrewPunctuationDetector';
import { ChapterDetector } from '../plugins/detectors/ChapterDetector';
import { ChunkSizeOptimizer } from '../plugins/processors/ChunkSizeOptimizer';
import { PluginConfig } from '../types';
import { ISplitDetector, IChunkProcessor } from '../interfaces';

export type PresetName = 'default' | 'narrative' | 'dialogue' | 'technical';

interface PresetConfig {
  detectors: Array<{
    plugin: new (config?: Partial<PluginConfig>) => ISplitDetector;
    config?: Partial<PluginConfig>;
  }>;
  processors: Array<{
    plugin: new (config?: Partial<PluginConfig>) => IChunkProcessor;
    config?: Partial<PluginConfig>;
  }>;
  splitterConfig?: Partial<PluginConfig>;
}

export const PRESETS: Record<PresetName, PresetConfig> = {
  default: {
    detectors: [
      { plugin: ChapterDetector },
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { plugin: ChunkSizeOptimizer }
    ]
  },
  
  narrative: {
    detectors: [
      { plugin: ChapterDetector },
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { 
        plugin: ChunkSizeOptimizer,
        config: { 
          minSize: 250,
          maxSize: 400, 
          targetSize: 350 
        }
      }
    ]
  },
  
  dialogue: {
    detectors: [
      { plugin: ChapterDetector },
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { 
        plugin: ChunkSizeOptimizer,
        config: { 
          minSize: 150, 
          maxSize: 300,
          targetSize: 250
        }
      }
    ]
  },
  
  technical: {
    detectors: [
      { plugin: ChapterDetector },
      { plugin: HebrewPunctuationDetector }
    ],
    processors: [
      { 
        plugin: ChunkSizeOptimizer,
        config: { 
          minSize: 300, 
          maxSize: 600,
          targetSize: 450
        }
      }
    ],
    splitterConfig: {
      maxChunkSize: 600,
      debug: true
    }
  }
};

export function createHebrewTTSSplitter(preset: PresetName = 'default'): HebrewTTSSplitter {
  const presetConfig = PRESETS[preset];
  const splitter = new HebrewTTSSplitter(presetConfig.splitterConfig);
  
  // Add detectors
  for (const { plugin: Plugin, config } of presetConfig.detectors) {
    const instance = new Plugin(config);
    splitter.addSplitDetector(instance);
  }
  
  // Add processors
  for (const { plugin: Plugin, config } of presetConfig.processors) {
    const instance = new Plugin(config);
    splitter.addProcessor(instance);
  }
  
  return splitter;
}
