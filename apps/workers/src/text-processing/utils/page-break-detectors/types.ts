export interface PageBreakIndicator {
  type: 'explicit' | 'structural' | 'stylistic' | 'semantic' | 'computed';
  confidence: number; // 0-1
  position: number;
  reason: string;
  elementTag?: string;
  elementText?: string;
}

export interface PageBreakOptions {
  targetPageSizeChars?: number;
  minPageSizeChars?: number;
  maxPageSizeChars?: number;
  includeExplicit?: boolean;
  includeStructural?: boolean;
  includeStylistic?: boolean;
  includeSemantic?: boolean;
  includeComputed?: boolean;
  minConfidence?: number;
}

export interface EPUBChapterContent {
  href: string;
  content: string;
  title?: string;
  chapterNumber: number;
}

export interface EPUBPageBreak {
  chapterHref: string;
  chapterNumber: number;
  position: number;
  type: string;
  confidence: number;
  reason: string;
  elementTag?: string;
  elementText?: string;
}

export interface PageLocation {
  pageNumber: number;
  href: string;
  label: string;
}

// Type for cheerio elements with tagName property
export type ElementWithTag = { tagName?: string };
