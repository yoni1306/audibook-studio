import { Logger } from '@nestjs/common';
import { NatsJavaScriptWorker } from './nats-worker';

const logger = new Logger('NatsJavaScriptWorker');

async function main() {
  try {
    // Create NATS worker (JobProcessor is created internally)
    const worker = new NatsJavaScriptWorker();
    
    // Start the worker
    await worker.start();
    
    logger.log('🚀 NATS JavaScript Worker started successfully');
    
    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.log(`🛑 Received ${signal}, shutting down gracefully...`);
      await worker.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
  } catch (error) {
    logger.error('❌ Failed to start NATS JavaScript Worker:', error);
    process.exit(1);
  }
}

// Start the worker
main().catch((error) => {
  logger.error('❌ Unhandled error in main:', error);
  process.exit(1);
});
