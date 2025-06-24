import { PluginConfig, SplitPoint, TextChunk } from '../types';

export { PluginConfig };

export interface IPlugin {
  readonly name: string;
  config: PluginConfig;
  isEnabled(): boolean;
  configure(config: Partial<PluginConfig>): void;
}

export interface ISplitDetector extends IPlugin {
  findSplitPoints(text: string): SplitPoint[];
}

export interface IChunkProcessor extends IPlugin {
  process(text: string, chunks: TextChunk[]): TextChunk[] | Promise<TextChunk[]>;
}
