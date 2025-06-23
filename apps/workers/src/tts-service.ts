import * as fs from 'fs/promises';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { createLogger } from '@audibook/logger';

const logger = createLogger('TTS');

export interface TTSOptions {
  voice?: string;
  rate?: number; // -50 to +50 (percentage)
  pitch?: number; // -50 to +50 (percentage)
}

export class AzureTTSService {
  private speechConfig: sdk.SpeechConfig;
  private defaultVoice: string;

  constructor(private options: TTSOptions) {
    const speechKey = process.env['AZURE_SPEECH_KEY'];
    const speechRegion = process.env['AZURE_SPEECH_REGION'] || 'westeurope';

    if (!speechKey) {
      throw new Error('AZURE_SPEECH_KEY is required');
    }

    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      speechKey,
      speechRegion
    );

    // Hebrew neural voice - AvriNeural (male) or HilaNeural (female)
    this.defaultVoice = process.env['AZURE_SPEECH_VOICE'] || 'he-IL-AvriNeural';
    this.speechConfig.speechSynthesisVoiceName = this.defaultVoice;

    // Set output format to MP3
    this.speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    logger.info(`TTS Service initialized with voice: ${this.defaultVoice}`);
  }

  async generateAudio(
    text: string,
    outputPath: string
  ): Promise<{
    duration: number;
    filePath: string;
  }> {
    return new Promise((resolve, reject) => {
      // Preprocess text for better Hebrew narration
      const processedText = this.preprocessHebrewText(text);

      // Build SSML for better control
      // const ssml = this.buildSSML(processedText, options);

      // Create audio config pointing to output file
      const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);

      // Create synthesizer
      const synthesizer = new sdk.SpeechSynthesizer(
        this.speechConfig,
        audioConfig
      );

      // Start synthesis
      logger.info(`Generating audio for text: "${text.substring(0, 50)}..."`);

      // Use simple text synthesis with the configured voice
      synthesizer.speakTextAsync(
        processedText,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            logger.info(`Audio generated successfully: ${outputPath}`);

            // Calculate duration from audio data
            const duration = result.audioDuration / 10000000; // Convert from 100-nanosecond units to seconds

            synthesizer.close();
            resolve({
              duration,
              filePath: outputPath,
            });
          } else {
            const error = `Speech synthesis canceled: ${result.errorDetails}`;
            logger.error(error);
            synthesizer.close();
            reject(new Error(error));
          }
        },
        (error) => {
          logger.error(`Error synthesizing speech: ${error}`);
          synthesizer.close();
          reject(error);
        }
      );

      // synthesizer.speakSsmlAsync(
      //   ssml,
      //   (result) => {
      //     if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      //       logger.info(`Audio generated successfully: ${outputPath}`);

      //       // Calculate duration from audio data
      //       const duration = result.audioDuration / 10000000; // Convert from 100-nanosecond units to seconds

      //       synthesizer.close();
      //       resolve({
      //         duration,
      //         filePath: outputPath,
      //       });
      //     } else {
      //       const error = `Speech synthesis canceled: ${result.errorDetails}`;
      //       logger.error(error);
      //       synthesizer.close();
      //       reject(new Error(error));
      //     }
      //   },
      //   (error) => {
      //     logger.error(`Error synthesizing speech: ${error}`);
      //     synthesizer.close();
      //     reject(error);
      //   }
      // );
    });
  }

  private preprocessHebrewText(text: string): string {
    // Best practices for Hebrew TTS preprocessing

    // 1. Normalize quotes
    text = text.replace(/["״]/g, '"').replace(/['׳]/g, "'");

    // 2. Handle Hebrew punctuation
    text = text.replace(/־/g, '-'); // Replace Hebrew maqaf with hyphen

    // 3. Add pauses after sentences for better flow
    text = text.replace(/\./g, '.');
    text = text.replace(/!/g, '!');
    text = text.replace(/\?/g, '?');

    // 4. Handle numbers in Hebrew context
    // Azure handles Hebrew numbers well, but we can help with context

    // 5. Clean excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  private buildSSML(text: string, options?: TTSOptions): string {
    const voice = options?.voice || this.defaultVoice;
    const rate = options?.rate || 0;
    const pitch = options?.pitch || 0;

    // Build SSML with best practices for Hebrew narration
    const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="he-IL">
  <voice name="${voice}">
    <prosody rate="${rate > 0 ? '+' : ''}${rate}%" pitch="${
      pitch > 0 ? '+' : ''
    }${pitch}%">
      ${this.addSSMLEnhancements(text)}
    </prosody>
  </voice>
</speak>`.trim();

    return ssml;
  }

  private addSSMLEnhancements(text: string): string {
    // Add breathing pauses for natural speech

    // 1. Add medium pause after periods
    text = text.replace(/\. /g, '.<break time="300ms"/> ');

    // 2. Add short pause after commas
    text = text.replace(/, /g, ',<break time="150ms"/> ');

    // 3. Add pause for dialogue
    text = text.replace(/" /g, '"<break time="200ms"/> ');

    // 4. Escape special XML characters
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 5. Handle emphasis for questions
    text = text.replace(/\?/g, '?<break time="300ms"/>');

    return text;
  }

  async testVoices(): Promise<void> {
    // Test available Hebrew voices
    const voices = [
      'he-IL-AvriNeural', // Male
      'he-IL-HilaNeural', // Female
    ];

    const testText = 'שלום, זהו מבחן של מערכת הטקסט לדיבור בעברית.';

    for (const voice of voices) {
      logger.info(`Testing voice: ${voice}`);
      this.speechConfig.speechSynthesisVoiceName = voice;

      try {
        const outputPath = `/tmp/test-${voice}.mp3`;
        await this.generateAudio(testText, outputPath);
        logger.info(`✓ ${voice} works correctly`);
        await fs.unlink(outputPath).catch((err) => logger.warn(`Failed to delete test file: ${err.message}`));
      } catch (error) {
        logger.error(`✗ ${voice} failed: ${error.message}`);
      }
    }

    // Reset to default voice
    this.speechConfig.speechSynthesisVoiceName = this.defaultVoice;
  }
}

// Singleton instance
let ttsService: AzureTTSService | null = null;

export function getTTSService(): AzureTTSService {
  if (!ttsService) {
    ttsService = new AzureTTSService({});
  }
  return ttsService;
}
