import { connect, NatsConnection, JetStreamClient, StringCodec, JsMsg, AckPolicy, DeliverPolicy } from 'nats';
import { Logger } from '@nestjs/common';
import { JobProcessor } from './job-processor';
// Job types are imported in JobProcessor
// import { EpubParsingJobData, AudioGenerationJobData, PageAudioCombinationJobData } from './job-types';

export class NatsJavaScriptWorker {
  private readonly logger = new Logger(NatsJavaScriptWorker.name);
  private natsConnection: NatsConnection;
  private jetstream: JetStreamClient;
  private sc = StringCodec();
  private isRunning = false;
  private jobProcessor: JobProcessor;

  // Consumer configuration - Match the API service
  private readonly STREAM_NAME = 'AUDIOBOOK_JOBS';
  private readonly CONSUMER_NAME = 'js-worker';
  private readonly JS_JOBS_SUBJECT = 'jobs.js.*';

  constructor() {
    this.jobProcessor = new JobProcessor();
  }

  async initialize() {
    try {
      // Connect to NATS
      const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
      this.natsConnection = await connect({ servers: natsUrl });
      this.logger.log(`✅ Connected to NATS at ${natsUrl}`);

      // Get JetStream context
      this.jetstream = this.natsConnection.jetstream();

      // Create consumer for JavaScript jobs
      await this.setupConsumer();
      
      this.logger.log('🚀 NATS JavaScript Worker initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize NATS JavaScript Worker', error);
      throw error;
    }
  }

  private async setupConsumer() {
    try {
      const jsm = await this.natsConnection.jetstreamManager();
      
      // Create or update consumer
      await jsm.consumers.add(this.STREAM_NAME, {
        durable_name: this.CONSUMER_NAME,
        filter_subject: this.JS_JOBS_SUBJECT,
        ack_policy: AckPolicy.Explicit, // Manual acknowledgment
        max_deliver: 3, // Retry up to 3 times
        ack_wait: 30 * 1000 * 1000 * 1000, // 30 seconds in nanoseconds
        deliver_policy: DeliverPolicy.All,
      });

      this.logger.log(`📋 Consumer ${this.CONSUMER_NAME} ready for ${this.JS_JOBS_SUBJECT}`);
    } catch (error) {
      this.logger.error('❌ Failed to setup consumer', error);
      throw error;
    }
  }

  async start() {
    await this.initialize();
    this.isRunning = true;
    
    this.logger.log('🚀 JavaScript Worker started, listening for jobs...');
    
    // Start consuming messages
    await this.consumeJobs();
  }

  async stop() {
    this.isRunning = false;
    if (this.natsConnection) {
      await this.natsConnection.close();
      this.logger.log('🔌 NATS connection closed');
    }
  }

  private async consumeJobs() {
    try {
      const consumer = await this.jetstream.consumers.get(this.STREAM_NAME, this.CONSUMER_NAME);
      
      // Consume messages
      const messages = await consumer.consume({
        max_messages: 1, // Process one message at a time
        idle_heartbeat: 1000, // 1 second heartbeat
      });

      for await (const msg of messages) {
        if (!this.isRunning) {
          break;
        }

        await this.processMessage(msg);
      }
    } catch (error) {
      this.logger.error('❌ Error in job consumption loop', error);
      if (this.isRunning) {
        // Restart consumption after a delay
        setTimeout(() => this.consumeJobs(), 5000);
      }
    }
  }

  private async processMessage(msg: JsMsg) {
    const startTime = Date.now();
    
    try {
      // Parse job data from message
      const messageData = this.sc.decode(msg.data);
      const jobMessage = JSON.parse(messageData);
      
      // Extract the actual job data from the nested structure
      const jobData = jobMessage.data || jobMessage;
      
      // Extract job type from NATS subject
      const jobType = msg.subject.split('.').pop(); // e.g., 'jobs.js.parse-epub' -> 'parse-epub'
      
      this.logger.log(`📥 Processing ${jobType} job`, {
        subject: msg.subject,
        correlationId: jobData.correlationId,
        seq: msg.seq,
      });

      // Process the job based on subject
      let result;
      switch (jobType) {
        case 'parse-epub':
          result = await this.jobProcessor.processEpubParsing(jobData);
          break;
        case 'generate-audio':
          result = await this.jobProcessor.processAudioGeneration(jobData);
          break;
        case 'combine-page-audio':
          result = await this.jobProcessor.processPageAudioCombination(jobData);
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      // Acknowledge successful processing
      msg.ack();
      
      this.logger.log(`✅ Job ${jobType} completed successfully`, {
        correlationId: jobData.correlationId,
        duration: Date.now() - startTime,
        result: result ? 'success' : 'completed',
      });
      
    } catch (error) {
      this.logger.error(`❌ Job processing failed`, {
        subject: msg.subject,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });
      
      // Negative acknowledge (will retry based on consumer config)
      msg.nak();
    }
  }
}
