import { HebrewTTSSplitter } from '../core/HebrewTTSSplitter';
import { HebrewPunctuationDetector } from '../plugins/detectors/HebrewPunctuationDetector';
import { ChapterDetector } from '../plugins/detectors/ChapterDetector';
import { ChunkSizeOptimizer } from '../plugins/processors/ChunkSizeOptimizer';
import { createHebrewTTSSplitter } from '../factory/presets';

describe('HebrewTTSSplitter', () => {
  let splitter: HebrewTTSSplitter;

  beforeEach(() => {
    splitter = new HebrewTTSSplitter({
      minChunkSize: 100,
      maxChunkSize: 500,
      debug: false
    });
  });

  describe('Basic functionality', () => {
    it('should create an instance with default config', () => {
      expect(splitter).toBeInstanceOf(HebrewTTSSplitter);
    });

    it('should add detectors and processors', () => {
      const detector = new HebrewPunctuationDetector();
      const processor = new ChunkSizeOptimizer();

      splitter.addSplitDetector(detector);
      splitter.addProcessor(processor);

      // Test that they were added (internal state check)
      expect(splitter['splitDetectors']).toHaveLength(1);
      expect(splitter['processors']).toHaveLength(1);
    });

    it('should set chapter titles', () => {
      const titles = ['Chapter 1', 'Chapter 2'];
      splitter.setChapterTitles(titles);
      
      expect(splitter['chapterTitles']).toEqual(titles);
    });
  });

  describe('Text splitting without chapters', () => {
    beforeEach(() => {
      splitter.addSplitDetector(new HebrewPunctuationDetector());
      splitter.addProcessor(new ChunkSizeOptimizer());
    });

    it('should split simple Hebrew text', async () => {
      const text = 'זה טקסט בעברית. יש כאן כמה משפטים. כל משפט צריך להיות מופרד בצורה נכונה.';
      
      const chunks = await splitter.splitText(text);
      
      expect(chunks).toHaveLength(1); // Should be one chunk since it's short
      expect(chunks[0].content).toBe(text);
      expect(chunks[0].position.start).toBe(0);
      expect(chunks[0].position.end).toBe(text.length);
    });

    it('should split long text into multiple chunks', async () => {
      const longText = 'זה טקסט ארוך מאוד בעברית. '.repeat(50); // Create long text
      
      const chunks = await splitter.splitText(longText);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(500);
        expect(chunk.content.trim()).toBeTruthy();
      });
    });

    it('should handle English text', async () => {
      const text = 'This is English text. It should also be processed correctly. Multiple sentences here.';
      
      const chunks = await splitter.splitText(text);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should handle mixed Hebrew and English', async () => {
      const text = 'This is mixed text עם עברית. Both languages should work together. זה צריך לעבוד טוב.';
      
      const chunks = await splitter.splitText(text);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
    });
  });

  describe('Chapter detection and processing', () => {
    beforeEach(() => {
      splitter.addSplitDetector(new ChapterDetector());
      splitter.addSplitDetector(new HebrewPunctuationDetector());
      splitter.addProcessor(new ChunkSizeOptimizer());
    });

    it('should detect Hebrew chapters', async () => {
      const text = `פרק 1: התחלה
זה התוכן של הפרק הראשון. יש כאן הרבה טקסט שצריך להיות מעובד.

פרק 2: המשך
וזה התוכן של הפרק השני. גם כאן יש טקסט חשוב.`;

      const chunks = await splitter.splitText(text);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that chapters were detected
      const chaptersFound = new Set(chunks.map(chunk => chunk.chapter?.id).filter(Boolean));
      expect(chaptersFound.size).toBeGreaterThan(0);
      
      // Check chapter titles
      const chapterTitles = chunks
        .map(chunk => chunk.chapter?.title)
        .filter(Boolean);
      expect(chapterTitles).toContain('התחלה');
      expect(chapterTitles).toContain('המשך');
    });

    it('should detect English chapters', async () => {
      const text = `Chapter 1: Beginning
This is the content of the first chapter. There is a lot of text here that needs to be processed.

Chapter 2: Continuation
And this is the content of the second chapter. Important text here too.`;

      const chunks = await splitter.splitText(text);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Check that chapters were detected
      const chaptersFound = new Set(chunks.map(chunk => chunk.chapter?.id).filter(Boolean));
      expect(chaptersFound.size).toBeGreaterThan(0);
    });

    it('should handle numbered chapters', async () => {
      const text = `1. First Section
Content of the first section goes here.

2. Second Section
Content of the second section goes here.`;

      const chunks = await splitter.splitText(text);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Should detect chapters
      const chaptersFound = new Set(chunks.map(chunk => chunk.chapter?.id).filter(Boolean));
      expect(chaptersFound.size).toBeGreaterThan(0);
    });
  });

  describe('Chunk metadata', () => {
    beforeEach(() => {
      splitter.addSplitDetector(new HebrewPunctuationDetector());
      splitter.addProcessor(new ChunkSizeOptimizer());
    });

    it('should include split type metadata', async () => {
      const text = 'Simple text for testing metadata.';
      
      const chunks = await splitter.splitText(text);
      
      expect(chunks[0].metadata).toBeDefined();
      expect(chunks[0].metadata?.splitType).toBeDefined();
    });

    it('should include position information', async () => {
      const text = 'Text with position information.';
      
      const chunks = await splitter.splitText(text);
      
      expect(chunks[0].position).toBeDefined();
      expect(chunks[0].position.start).toBe(0);
      expect(chunks[0].position.end).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle empty text', async () => {
      const chunks = await splitter.splitText('');
      
      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only text', async () => {
      const chunks = await splitter.splitText('   \n\t   ');
      
      expect(chunks).toHaveLength(0);
    });

    it('should handle very short text', async () => {
      const chunks = await splitter.splitText('Hi');
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Hi');
    });
  });
});

describe('HebrewPunctuationDetector', () => {
  let detector: HebrewPunctuationDetector;

  beforeEach(() => {
    detector = new HebrewPunctuationDetector();
  });

  it('should detect Hebrew sentence endings', () => {
    const text = 'זה משפט ראשון׃ זה משפט שני.';
    
    const points = detector.findSplitPoints(text);
    
    expect(points.length).toBeGreaterThan(0);
    expect(points.some(p => p.marker === '׃')).toBe(true);
    expect(points.some(p => p.marker === '.')).toBe(true);
  });

  it('should detect commas and semicolons', () => {
    const text = 'ראשון, שני; שלישי.';
    
    const points = detector.findSplitPoints(text);
    
    expect(points.some(p => p.marker === ',')).toBe(true);
    expect(points.some(p => p.marker === ';')).toBe(true);
  });

  it('should provide context for split points', () => {
    const text = 'טקסט לפני נקודה. טקסט אחרי נקודה.';
    
    const points = detector.findSplitPoints(text);
    
    const dotPoint = points.find(p => p.marker === '.');
    expect(dotPoint).toBeDefined();
    if (dotPoint) {
      expect(dotPoint.context.before).toContain('נקודה');
      expect(dotPoint.context.after).toContain('טקסט');
    }
  });
});

describe('ChapterDetector', () => {
  let detector: ChapterDetector;

  beforeEach(() => {
    detector = new ChapterDetector();
  });

  it('should detect Hebrew chapter patterns', () => {
    const text = 'פרק א: כותרת הפרק\nתוכן הפרק כאן.';
    
    const points = detector.findSplitPoints(text);
    
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].metadata?.type).toBe('chapter');
    expect(points[0].metadata?.title).toBe('כותרת הפרק');
  });

  it('should detect English chapter patterns', () => {
    const text = 'Chapter 1: Chapter Title\nChapter content here.';
    
    const points = detector.findSplitPoints(text);
    
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].metadata?.type).toBe('chapter');
    expect(points[0].metadata?.title).toBe('Chapter Title');
  });

  it('should detect numbered sections', () => {
    const text = '1. Section Title\nSection content here.';
    
    const points = detector.findSplitPoints(text);
    
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].metadata?.type).toBe('chapter');
  });
});

describe('Preset configurations', () => {
  it('should create default preset', () => {
    const splitter = createHebrewTTSSplitter('default');
    
    expect(splitter).toBeInstanceOf(HebrewTTSSplitter);
    expect(splitter['splitDetectors']).toHaveLength(2); // Chapter + Hebrew punctuation
    expect(splitter['processors']).toHaveLength(1); // Chunk optimizer
  });

  it('should create narrative preset', () => {
    const splitter = createHebrewTTSSplitter('narrative');
    
    expect(splitter).toBeInstanceOf(HebrewTTSSplitter);
  });

  it('should create dialogue preset', () => {
    const splitter = createHebrewTTSSplitter('dialogue');
    
    expect(splitter).toBeInstanceOf(HebrewTTSSplitter);
  });

  it('should create technical preset', () => {
    const splitter = createHebrewTTSSplitter('technical');
    
    expect(splitter).toBeInstanceOf(HebrewTTSSplitter);
  });
});
