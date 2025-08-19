import { createTTSService, AzureTTSService, TTSConfig, TTSSettings } from './tts-service';
import * as fs from 'fs/promises';

// Mock fs.writeFile for testing
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

// Mock Azure Speech SDK
jest.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: {
    fromSubscription: jest.fn(() => ({
      speechSynthesisVoiceName: 'he-IL-AvriNeural',
      speechSynthesisOutputFormat: undefined,
    })),
  },
  SpeechSynthesizer: jest.fn(() => ({
    speakTextAsync: jest.fn((text, callback) => {
      const mockResult = {
        audioData: new ArrayBuffer(1024),
        audioDuration: 50000000, // 5 seconds in 100-nanosecond units
        reason: 'SynthesizingAudioCompleted',
      };
      callback(mockResult);
    }),
    close: jest.fn(),
  })),
  AudioConfig: {
    fromAudioFileOutput: jest.fn(),
  },
  SpeechSynthesisOutputFormat: {
    Audio16Khz32KBitRateMonoMp3: 'Audio16Khz32KBitRateMonoMp3',
  },
  ResultReason: {
    SynthesizingAudioCompleted: 'SynthesizingAudioCompleted',
  },
}));

// Mock environment variables
process.env.AZURE_SPEECH_KEY = 'test-key';
process.env.AZURE_SPEECH_REGION = 'westeurope';

describe('TTS Service Factory', () => {
  const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
  const mockUnlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFile.mockResolvedValue();
    mockUnlink.mockResolvedValue();
  });

  describe('createTTSService', () => {
    it('should create Azure TTS service with default configuration', () => {
      const config: TTSConfig = {
        model: 'azure',
      };

      const service = createTTSService(config);
      expect(service).toBeInstanceOf(AzureTTSService);
    });

    it('should create Azure TTS service with custom voice and settings', () => {
      const config: TTSConfig = {
        model: 'azure',
        voice: 'en-US-AriaNeural',
        settings: {
          rate: 10,
          pitch: -5,
          volume: 80,
        },
      };

      const service = createTTSService(config);
      expect(service).toBeInstanceOf(AzureTTSService);
    });

    it('should fallback to Azure for unknown TTS models', () => {
      const config: TTSConfig = {
        model: 'unknown-provider',
        voice: 'test-voice',
      };

      const service = createTTSService(config);
      expect(service).toBeInstanceOf(AzureTTSService);
    });

    it('should handle Hebrew voice configuration', () => {
      const config: TTSConfig = {
        model: 'azure',
        voice: 'he-IL-AvriNeural',
        settings: {
          rate: 0,
          pitch: 0,
        },
      };

      const service = createTTSService(config);
      expect(service).toBeInstanceOf(AzureTTSService);
    });
  });

  describe('Azure TTS Service Integration', () => {
    it('should create service and handle audio generation', async () => {
      const config: TTSConfig = {
        model: 'azure',
        voice: 'en-US-AriaNeural',
        settings: { rate: 10, pitch: 0 },
      };

      const service = createTTSService(config);
      expect(service).toBeInstanceOf(AzureTTSService);

      // Test that the service can be called (mocked)
      const result = await service.generateAudio('Hello world', '/tmp/test.mp3');
      expect(result).toBeDefined();
      expect(result.duration).toBe(5); // 5 seconds from mock
      expect(result.filePath).toBe('/tmp/test.mp3');
    });

    it('should handle Hebrew text generation', async () => {
      const config: TTSConfig = {
        model: 'azure',
        voice: 'he-IL-AvriNeural',
        settings: { rate: 0, pitch: 0 },
      };

      const service = createTTSService(config);
      const result = await service.generateAudio('שלום עולם', '/tmp/hebrew.mp3');
      
      expect(result).toBeDefined();
      expect(result.duration).toBe(5);
      expect(result.filePath).toBe('/tmp/hebrew.mp3');
    });
  });

  describe('TTS Settings and Configuration', () => {
    it('should handle various TTS settings formats', () => {
      const testSettings: TTSSettings[] = [
        { rate: 10, pitch: -5, volume: 80 },
        { rate: 0, pitch: 0 },
        {},
      ];
      
      testSettings.forEach(settings => {
        const config: TTSConfig = {
          model: 'azure',
          voice: 'en-US-AriaNeural',
          settings,
        };
        
        const service = createTTSService(config);
        expect(service).toBeInstanceOf(AzureTTSService);
      });
    });

    it('should handle provider-specific settings', () => {
      const azureSettings = { rate: 10, pitch: -5, volume: 80 };
      const openaiSettings = { speed: 1.25 };
      const elevenLabsSettings = { stability: 0.8, similarity_boost: 0.7 };
      
      const configs = [
        { model: 'azure', settings: azureSettings },
        { model: 'openai', settings: openaiSettings },
        { model: 'elevenlabs', settings: elevenLabsSettings },
      ];
      
      configs.forEach(config => {
        const service = createTTSService(config as TTSConfig);
        expect(service).toBeInstanceOf(AzureTTSService); // All fallback to Azure currently
      });
    });
  });

  describe('Multimodal Integration', () => {
    it('should support book-specific TTS configuration', () => {
      const bookConfig: TTSConfig = {
        model: 'azure',
        voice: 'he-IL-AvriNeural',
        settings: { rate: 0, pitch: 0 },
      };
      
      const service = createTTSService(bookConfig);
      expect(service).toBeInstanceOf(AzureTTSService);
    });

    it('should handle different language configurations', () => {
      const languageConfigs = [
        { model: 'azure', voice: 'en-US-AriaNeural' },
        { model: 'azure', voice: 'he-IL-AvriNeural' },
        { model: 'azure', voice: 'fr-FR-DeniseNeural' },
        { model: 'azure', voice: 'es-ES-ElviraNeural' },
      ];
      
      languageConfigs.forEach(config => {
        const service = createTTSService(config as TTSConfig);
        expect(service).toBeInstanceOf(AzureTTSService);
      });
    });
  });
});
