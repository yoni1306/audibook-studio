import { SplitPoint, TextChunk } from '../types';

export interface ISplitDetector {
  readonly name: string;
  findSplitPoints(text: string): SplitPoint[];
}

export interface IChunkProcessor {
  readonly name: string;
  process(text: string, chunks: TextChunk[]): Promise<TextChunk[]>;
}

export interface ITextSplitter {
  splitText(text: string): Promise<TextChunk[]>;
  addSplitDetector(detector: ISplitDetector): void;
  addProcessor(processor: IChunkProcessor): void;
}
