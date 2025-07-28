import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { S3Service } from '../s3/s3.service';

interface AudioGenerationJobData {
  paragraphId: string;
  bookId: string;
  content: string;
}

@Injectable()
@Processor('audio')
export class AudioProcessorService extends WorkerHost {
  private readonly logger = new Logger(AudioProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private metricsService: MetricsService,
    private s3Service: S3Service
  ) {
    super();
  }

  async process(job: Job<AudioGenerationJobData>) {
    if (job.name !== 'generate-audio') {
      return;
    }
    
    return this.handleAudioGeneration(job);
  }

  private async handleAudioGeneration(job: Job<AudioGenerationJobData>) {
    const { paragraphId, bookId, content } = job.data;
    const startTime = Date.now();
    
    this.logger.log(`🎵 Starting audio generation for paragraph ${paragraphId}`);

    try {
      // Update paragraph status to GENERATING
      await this.prisma.paragraph.update({
        where: { id: paragraphId },
        data: { audioStatus: 'GENERATING' }
      });

      // TODO: Implement actual TTS/audio generation here
      // For now, we'll simulate audio generation with a delay
      await this.simulateAudioGeneration(content);
      
      // Generate a mock S3 key for the audio file
      const audioS3Key = `audio/${bookId}/${paragraphId}.mp3`;
      
      // TODO: Upload actual audio file to S3
      // For now, we'll just set the S3 key
      
      // Update paragraph with audio S3 key and status
      await this.prisma.paragraph.update({
        where: { id: paragraphId },
        data: { 
          audioS3Key,
          audioStatus: 'READY'
        }
      });

      const duration = Date.now() - startTime;
      
      // Record successful audio generation metrics
      // Record successful audio generation metrics (non-blocking)
      try {
        await this.metricsService.recordAudioGeneration(
          bookId,
          paragraphId,
          duration,
          true // success
        );
      } catch (metricsError) {
        this.logger.warn(`Failed to record audio generation metrics: ${metricsError.message}`);
      }

      this.logger.log(`✅ Audio generation completed for paragraph ${paragraphId} in ${duration}ms`);
      
      return { success: true, audioS3Key, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error(`❌ Audio generation failed for paragraph ${paragraphId}:`, error);
      
      // Update paragraph status to FAILED
      await this.prisma.paragraph.update({
        where: { id: paragraphId },
        data: { audioStatus: 'ERROR' }
      });

      // Record failed audio generation metrics (non-blocking)
      try {
        await this.metricsService.recordAudioGeneration(
          bookId,
          paragraphId,
          duration,
          false, // success = false
          error.message
        );
      } catch (metricsError) {
        this.logger.warn(`Failed to record audio generation failure metrics: ${metricsError.message}`);
      }

      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<AudioGenerationJobData>) {
    this.logger.log(`🔄 Processing audio generation job ${job.id} for paragraph ${job.data.paragraphId}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<AudioGenerationJobData>, result: { success: boolean; audioS3Key: string; duration: number }) {
    this.logger.log(`✅ Audio generation job ${job.id} completed for paragraph ${job.data.paragraphId} in ${result.duration}ms`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AudioGenerationJobData>, error: Error) {
    this.logger.error(`❌ Audio generation job ${job.id} failed for paragraph ${job.data.paragraphId}:`, error);
  }

  /**
   * Simulate audio generation with a realistic delay
   * TODO: Replace with actual TTS service integration
   */
  private async simulateAudioGeneration(content: string): Promise<void> {
    // Simulate processing time based on content length
    const baseTime = 1000; // 1 second base time
    const timePerChar = 10; // 10ms per character
    const processingTime = Math.min(baseTime + (content.length * timePerChar), 10000); // Max 10 seconds
    
    this.logger.log(`🎵 Simulating audio generation for ${processingTime}ms`);
    
    return new Promise((resolve) => {
      setTimeout(resolve, processingTime);
    });
  }


}
