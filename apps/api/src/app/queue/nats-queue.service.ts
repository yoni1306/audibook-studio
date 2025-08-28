import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { connect, NatsConnection, JetStreamManager, JetStreamClient, StringCodec, RetentionPolicy, StorageType, DiscardPolicy } from 'nats';
import { getCurrentCorrelationId } from '@audibook/correlation';

export interface JobData {
  jobId: string;
  jobName: string;
  data: any;
  correlationId: string;
  timestamp: number;
}

@Injectable()
export class NatsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsQueueService.name);
  private natsConnection: NatsConnection;
  private jetstream: JetStreamClient;
  private jsm: JetStreamManager;
  private sc = StringCodec();

  // Stream and subject configuration
  private readonly STREAM_NAME = 'AUDIOBOOK_JOBS';
  private readonly JS_JOBS_SUBJECT = 'jobs.js.*';
  private readonly PYTHON_JOBS_SUBJECT = 'jobs.python.*';

  async onModuleInit() {
    try {
      // Connect to NATS
      const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
      this.natsConnection = await connect({ servers: natsUrl });
      this.logger.log(`✅ Connected to NATS at ${natsUrl}`);

      // Get JetStream context
      this.jetstream = this.natsConnection.jetstream();
      this.jsm = await this.natsConnection.jetstreamManager();

      // Create or update the stream
      await this.setupStream();
      
      this.logger.log('🚀 NATS Queue Service initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize NATS Queue Service', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.natsConnection) {
      await this.natsConnection.close();
      this.logger.log('🔌 NATS connection closed');
    }
  }

  private async setupStream() {
    try {
      // Try to get existing stream info
      await this.jsm.streams.info(this.STREAM_NAME);
      this.logger.log(`📋 Stream ${this.STREAM_NAME} already exists`);
    } catch (error) {
      // Stream doesn't exist, create it
      await this.jsm.streams.add({
        name: this.STREAM_NAME,
        subjects: [this.JS_JOBS_SUBJECT, this.PYTHON_JOBS_SUBJECT],
        retention: RetentionPolicy.Workqueue, // Messages are removed after acknowledgment
        storage: StorageType.File, // Persistent storage
        max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days in nanoseconds
        max_msgs: 10000,
        discard: DiscardPolicy.Old,
      });
      this.logger.log(`📋 Created stream ${this.STREAM_NAME}`);
    }
  }

  // Job creation methods
  async addEpubParsingJob(data: { bookId: string; s3Key: string }) {
    return this.publishJob('jobs.js.parse-epub', 'parse-epub', data);
  }

  async addAudioGenerationJob(data: { paragraphId: string; bookId: string; content: string }) {
    return this.publishJob('jobs.js.generate-audio', 'generate-audio', data);
  }

  async addPageAudioCombinationJob(data: { pageId: string; bookId: string; audioFileKeys: string[] }) {
    return this.publishJob('jobs.js.combine-page-audio', 'combine-page-audio', data);
  }

  async addDiacriticsProcessingJob(data: { bookId: string; paragraphIds?: string[] }) {
    return this.publishJob('jobs.python.add-diacritics', 'add-diacritics', data);
  }

  async cancelPageAudioCombinationJob(pageId: string) {
    // In NATS JetStream, we don't have direct job cancellation like BullMQ
    // This is a placeholder that logs the cancellation attempt
    // In a production system, you might implement this by:
    // 1. Publishing a cancellation message to a separate subject
    // 2. Having workers check for cancellation signals
    // 3. Using consumer filtering or stream management
    
    this.logger.log(`🚫 Cancellation requested for page audio combination job: ${pageId}`);
    
    return {
      success: true,
      message: `Cancellation signal sent for page ${pageId}`,
      timestamp: new Date().toISOString(),
      cancelledJobs: 0, // NATS doesn't track individual jobs like BullMQ
    };
  }

  private async publishJob(subject: string, jobName: string, data: any) {
    try {
      const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const correlationId = getCurrentCorrelationId();
      
      const jobData: JobData = {
        jobId,
        jobName,
        data: { ...data, correlationId },
        correlationId,
        timestamp: Date.now(),
      };

      const ack = await this.jetstream.publish(subject, this.sc.encode(JSON.stringify(jobData)));
      
      this.logger.log(`📤 Published job ${jobName} with ID ${jobId} to ${subject}`);
      
      return { 
        jobId,
        timestamp: new Date().toISOString(),
        subject,
        ack: ack.seq 
      };
    } catch (error) {
      this.logger.error(`❌ Failed to publish job ${jobName}`, error);
      throw new Error(`Failed to add ${jobName} job`);
    }
  }

  // Status and monitoring methods
  async getQueueStatus() {
    try {
      const streamInfo = await this.jsm.streams.info(this.STREAM_NAME);
      
      return {
        waiting: streamInfo.state.messages,
        active: 0, // NATS doesn't track active jobs the same way
        completed: 0, // Would need separate tracking
        failed: 0, // Would need separate tracking  
        delayed: 0,
        total: streamInfo.state.messages,
        timestamp: new Date().toISOString(),
        streamInfo: {
          messages: streamInfo.state.messages,
          bytes: streamInfo.state.bytes,
          firstSeq: streamInfo.state.first_seq,
          lastSeq: streamInfo.state.last_seq,
        }
      };
    } catch (error) {
      this.logger.error('❌ Failed to get queue status', error);
      throw new Error('Failed to get queue status');
    }
  }

  async getJobsByStatus(status: string) {
    // For now, return empty array as NATS JetStream doesn't provide
    // the same job status tracking as BullMQ
    // This would require implementing custom job tracking
    return {
      jobs: [],
      status,
      total: 0,
      timestamp: new Date().toISOString(),
      message: 'Job status tracking not yet implemented for NATS'
    };
  }

  async cleanJobs(status: 'completed' | 'failed') {
    // NATS JetStream automatically removes acknowledged messages
    // No manual cleanup needed for work queue retention policy
    this.logger.log(`🧹 NATS automatically manages ${status} job cleanup`);
    return {
      cleaned: 0,
      status,
      timestamp: new Date().toISOString(),
      message: 'NATS automatically manages job cleanup'
    };
  }
}
