export enum SplitPriority {
  CHAPTER = 1000,
  SECTION = 800,
  PARAGRAPH = 600,
  SENTENCE = 400,
  WORD = 200,
}

export interface SplitPoint {
  position: number;
  priority: number;
  marker: string;
  context: {
    before: string;
    after: string;
  };
  metadata?: {
    type: string;
    [key: string]: any;
  };
}

export interface TextChunk {
  content: string;
  position: {
    start: number;
    end: number;
  };
  metadata?: {
    chapterNumber?: number;
    pageNumber?: number;
    type?: string;
    [key: string]: any;
  };
}

export interface Chapter {
  id: string;
  title: string;
  position: {
    start: number;
    end: number;
  };
  content: string;
}

export interface EPUBPage {
  content: string;
  sourceFile: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
}

export interface EPUBChapter {
  title: string;
  href: string;
  content?: string;
  pages?: EPUBPage[];
}

export interface EPUBMetadata {
  title: string;
  author: string;
  language: string;
  chapters: EPUBChapter[];
}
