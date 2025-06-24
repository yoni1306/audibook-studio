import { BasePlugin } from '../base/BasePlugin';
import { IChunkProcessor } from '../../interfaces';
import { TextChunk } from '../../types';

export class SSMLWrapper extends BasePlugin implements IChunkProcessor {
  readonly name = 'SSMLWrapper';

  protected getDefaultConfig() {
    return {
      addSSMLTags: true,
      addBreaks: true,
      hebrewVoiceSettings: {
        rate: 'medium',
        pitch: 'medium',
        volume: 'medium',
      },
    };
  }

  async process(text: string, chunks: TextChunk[]): Promise<TextChunk[]> {
    if (!this.config.addSSMLTags) {
      return chunks;
    }

    return chunks.map(chunk => ({
      ...chunk,
      content: this.wrapWithSSML(chunk.content, chunk.metadata),
    }));
  }

  private wrapWithSSML(content: string, metadata?: Record<string, unknown>): string {
    const settings = this.config.hebrewVoiceSettings as {
      rate: string;
      pitch: string;
      volume: string;
    };
    
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="he-IL">`;
    
    // Add voice settings
    ssml += `<voice name="he-IL-HilaNeural">`;
    ssml += `<prosody rate="${settings.rate}" pitch="${settings.pitch}" volume="${settings.volume}">`;
    
    // Add content with appropriate breaks
    if (this.config.addBreaks) {
      // Add pause at the beginning if it's a new chapter
      if (metadata?.type === 'manual_chapter' || metadata?.type === 'epub_page') {
        ssml += '<break time="1s"/>';
      }
      
      // Process content to add natural breaks
      const processedContent = this.addNaturalBreaks(content);
      ssml += processedContent;
      
      // Add pause at the end
      ssml += '<break time="500ms"/>';
    } else {
      ssml += this.escapeXML(content);
    }
    
    ssml += '</prosody>';
    ssml += '</voice>';
    ssml += '</speak>';
    
    return ssml;
  }

  private addNaturalBreaks(content: string): string {
    let processed = this.escapeXML(content);
    
    // Add breaks after Hebrew sentence endings
    processed = processed.replace(/([׃.!?]+)\s+/g, '$1<break time="300ms"/> ');
    
    // Add breaks after paragraph separations
    processed = processed.replace(/\n\s*\n/g, '<break time="500ms"/>\n\n');
    
    // Add slight breaks after commas
    processed = processed.replace(/([,،])\s+/g, '$1<break time="100ms"/> ');
    
    return processed;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
