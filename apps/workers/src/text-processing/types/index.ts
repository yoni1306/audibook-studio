export enum SplitPriority {
  CHAPTER = 0,
  PARAGRAPH = 1,
  SENTENCE_END = 2,
  SEMICOLON = 3,
  COMMA = 4,
  SPACE = 5
}

export interface Position {
  start: number;
  end: number;
}

export interface SplitPoint {
  position: number;
  priority: SplitPriority;
  marker: string;
  context: {
    before: string;
    after: string;
  };
  metadata?: Record<string, unknown>;
}

export interface TextChunk {
  content: string;
  position: Position;
  metadata?: ChunkMetadata;
  chapter?: ChapterInfo;
}

export interface ChunkMetadata {
  splitType?: string;
  ssml?: boolean;
  originalContent?: string;
  merged?: boolean;
  split?: boolean;
  [key: string]: unknown;
}

export interface ChapterInfo {
  id: string;
  title: string;
  index: number;
  chunkIndex: number;
}

export interface Chapter {
  id: string;
  title: string;
  position: Position;
  content: string;
  chunks?: TextChunk[];
}

export interface PluginConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface SplitterConfig {
  minChunkSize: number;
  maxChunkSize: number;
  debug: boolean;
  [key: string]: unknown;
}
