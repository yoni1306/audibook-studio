import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Integration Test for Page Audio Combination using Real System Services
 * 
 * This test validates the actual worker job processing logic by:
 * 1. Using real MP3 files provided by the user (hello.mp3 and world.mp3)
 * 2. Testing the exact FFmpeg combination logic used in production
 * 3. Validating that combined audio duration equals sum of individual files
 * 4. Ensuring the output format matches worker configuration
 */
describe('Page Audio Combination - System Integration Test', () => {
  let tempDir: string;
  let helloMp3Path: string;
  let worldMp3Path: string;
  let outputFile: string;
  const activeCommands: ffmpeg.FfmpegCommand[] = [];

  beforeAll(async () => {
    // Paths to the real audio files provided by the user
    helloMp3Path = path.resolve('/Users/yonica/Dev/audibook-studio/hello.mp3');
    worldMp3Path = path.resolve('/Users/yonica/Dev/audibook-studio/world.mp3');

    // Verify the real audio files exist
    try {
      await fs.access(helloMp3Path);
      await fs.access(worldMp3Path);
      console.log('✅ Found real audio files: hello.mp3 and world.mp3');
    } catch {
      throw new Error(`❌ Real audio files not found. Expected: ${helloMp3Path} and ${worldMp3Path}`);
    }

    // Create temporary directory for test outputs
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-test-'));
    outputFile = path.join(tempDir, 'combined-output.mp3');
    
    // Get audio file information for logging
    const file1Stats = await fs.stat(helloMp3Path);
    const file2Stats = await fs.stat(worldMp3Path);
    console.log(`📊 hello.mp3: ${file1Stats.size} bytes`);
    console.log(`📊 world.mp3: ${file2Stats.size} bytes`);
  });

  afterAll(async () => {
    // Kill any active FFmpeg processes
    activeCommands.forEach(command => {
      try {
        command.kill('SIGKILL');
      } catch {
        // Ignore errors when killing already finished processes
      }
    });
    activeCommands.length = 0;

    // Wait a bit for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clean up temporary files
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error);
      }
    }
  });

  describe('Worker Audio Combination Logic', () => {
    it('should use exact worker logic to combine real MP3 files and validate duration', async () => {
      // Get individual file durations
      const duration1 = await getAudioDuration(helloMp3Path);
      const duration2 = await getAudioDuration(worldMp3Path);
      const expectedTotalDuration = duration1 + duration2;
      
      console.log(`🎧 Combining hello.mp3 (${duration1}s) + world.mp3 (${duration2}s) = expected ${expectedTotalDuration}s`);
      
      // Use the EXACT same logic as the worker's audio combination
      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg();
        activeCommands.push(command);
        
        // Add all input files (same as worker)
        [helloMp3Path, worldMp3Path].forEach(file => {
          command = command.input(file);
        });
        
        // Set output options (same as worker - from main.ts line 436-439)
        command
          .audioCodec('libmp3lame')    // Worker uses 'libmp3lame' for compatibility
          .audioBitrate('128k')        // Worker uses '128k'
          .audioFrequency(22050)       // Worker uses 22050
          .audioChannels(1)            // Worker uses 1 (mono)
          .on('start', (commandLine) => {
            console.log('🔧 FFmpeg command:', commandLine);
          })
          .on('end', () => {
            console.log('✅ Audio combination completed successfully');
            resolve();
          })
          .on('error', (err) => {
            console.error('❌ Audio combination failed:', err.message);
            reject(err);
          })
          .mergeToFile(outputFile, os.tmpdir()); // Worker uses mergeToFile
      });
      
      // Verify output file was created
      const outputStats = await fs.stat(outputFile);
      expect(outputStats.size).toBeGreaterThan(0);
      console.log(`✅ Combined output: ${outputStats.size} bytes`);
      
      // CRITICAL VALIDATION: Combined duration should equal sum of individual durations
      const actualCombinedDuration = await getAudioDuration(outputFile);
      expect(actualCombinedDuration).toBeCloseTo(expectedTotalDuration, 1); // Within 0.1 second tolerance
      
      console.log(`✅ Duration validation: ${duration1}s + ${duration2}s = ${actualCombinedDuration}s (expected: ${expectedTotalDuration}s)`);
    });

    it('should validate output format matches worker configuration', async () => {
      // Use the worker logic to combine files
      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg();
        activeCommands.push(command);
        
        [helloMp3Path, worldMp3Path].forEach(file => {
          command = command.input(file);
        });
        
        command
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .audioFrequency(22050)
          .audioChannels(1)
          .on('end', () => resolve())
          .on('error', reject)
          .mergeToFile(outputFile, os.tmpdir());
      });

      // Get audio properties
      const properties = await getAudioProperties(outputFile);
      
      // Verify audio format matches worker configuration
      expect(properties.format).toBe('mp3');
      expect(properties.sampleRate).toBe(22050); // Worker configuration
      expect(properties.channels).toBe(1); // Worker configuration (mono)
      
      console.log(`🎵 Output format: ${properties.format}, ${properties.sampleRate}Hz, ${properties.channels} channel(s)`);
    });
  });
});

// Helper functions using ffprobe (same as production would use)

// Get audio duration using ffprobe
async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

// Get audio properties using ffprobe
async function getAudioProperties(filePath: string): Promise<{ format: string; sampleRate: number; channels: number; bitrate?: string }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        if (!audioStream) {
          reject(new Error('No audio stream found'));
        } else {
          resolve({
            format: metadata.format.format_name?.includes('mp3') ? 'mp3' : metadata.format.format_name || 'unknown',
            sampleRate: audioStream.sample_rate || 0,
            channels: audioStream.channels || 0,
            bitrate: audioStream.bit_rate ? `${Math.round(parseInt(audioStream.bit_rate) / 1000)}k` : undefined,
          });
        }
      }
    });
  });
}
