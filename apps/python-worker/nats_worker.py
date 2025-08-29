"""
NATS JetStream Python Worker

This module implements a Python worker that uses NATS JetStream
for reliable job processing with native NATS support.
"""

import os
import json
import asyncio
import signal
from typing import Dict, Any, Optional
import structlog
from nats.aio.client import Client as NATS
from nats.js import JetStreamContext
from nats.js.api import ConsumerConfig, AckPolicy, DeliverPolicy, StreamConfig
# Import services
from services.job_processor import JobProcessor
from services.database_orm import DatabaseORMService
from services.diacritics import DiacriticsService

# Setup logging
from logging_config import configure_logging
configure_logging()
logger = structlog.get_logger("nats-python-worker")

class JobData:
    def __init__(self, job_id: str, job_name: str, data: Dict[str, Any], 
                 correlation_id: str, timestamp: int):
        self.job_id = job_id
        self.job_name = job_name
        self.data = data
        self.correlation_id = correlation_id
        self.timestamp = timestamp

class NatsPythonWorker:
    """
    NATS JetStream Python Worker for processing diacritics jobs.
    
    Features:
    - Native NATS JetStream integration
    - Automatic retries and error handling
    - Structured logging with correlation IDs
    - Graceful shutdown handling
    """
    
    def __init__(self):
        self.nats_url = os.getenv('NATS_URL', 'nats://localhost:4222')
        self.nats_client: Optional[NATS] = None
        self.jetstream: Optional[JetStreamContext] = None
        self.job_processor: Optional[JobProcessor] = None
        self.running = False
        self.shutdown_requested = False
        
        # Stream and consumer configuration
        self.STREAM_NAME = 'AUDIOBOOK_JOBS'
        self.CONSUMER_NAME = 'python-worker'
        self.PYTHON_JOBS_SUBJECT = 'jobs.python.*'
    
    async def initialize(self):
        """Initialize NATS connection and job processor"""
        try:
            # Connect to NATS with better error handling and connection options
            logger.info("🔌 Attempting to connect to NATS", extra={
                "nats_url": self.nats_url
            })
            
            self.nats_client = NATS()
            await self.nats_client.connect(
                servers=self.nats_url,
                connect_timeout=10,  # 10 second timeout
                max_reconnect_attempts=5,
                reconnect_time_wait=2,  # 2 seconds between reconnect attempts
                error_cb=self._error_callback,
                disconnected_cb=self._disconnected_callback,
                reconnected_cb=self._reconnected_callback
            )
            logger.info("✅ Connected to NATS successfully", extra={
                "nats_url": self.nats_url,
                "server_info": str(self.nats_client._server_info) if hasattr(self.nats_client, '_server_info') and self.nats_client._server_info else "N/A"
            })
            
            # Get JetStream context
            self.jetstream = self.nats_client.jetstream()
            
            # Setup stream (create if not exists)
            await self.setup_stream()
            
            # Setup consumer (create if not exists)
            await self.setup_consumer()
            
            # Initialize services
            database_url = os.getenv('DATABASE_URL')
            if not database_url:
                raise ValueError("DATABASE_URL environment variable is required")
            
            db_service = DatabaseORMService(database_url)
            await db_service.connect()
            
            diacritics_service = DiacriticsService()
            await diacritics_service.initialize()
            
            # Initialize job processor with services
            self.job_processor = JobProcessor(db_service, diacritics_service)
            logger.info("✅ Job processor initialized")
            
        except Exception as error:
            logger.error("❌ Failed to initialize worker", extra={
                "error": str(error),
                "error_type": type(error).__name__,
                "nats_url": self.nats_url
            })
            raise
    
    async def _error_callback(self, error):
        """Handle NATS connection errors"""
        logger.error("🚨 NATS connection error", extra={
            "error": str(error),
            "error_type": type(error).__name__,
            "nats_url": self.nats_url
        })
    
    async def _disconnected_callback(self):
        """Handle NATS disconnection"""
        logger.warning("⚠️ NATS connection lost", extra={
            "nats_url": self.nats_url
        })
    
    async def _reconnected_callback(self):
        """Handle NATS reconnection"""
        logger.info("🔄 NATS connection restored", extra={
            "nats_url": self.nats_url
        })
    
    async def setup_stream(self):
        """Create or update the JetStream stream for jobs"""
        try:
            # Check if stream already exists
            try:
                stream_info = await self.jetstream.stream_info(self.STREAM_NAME)
                logger.info("📊 Stream already exists", stream=self.STREAM_NAME)
                return
            except Exception:
                # Stream doesn't exist, create it
                pass
            
            # Create stream configuration
            stream_config = StreamConfig(
                name=self.STREAM_NAME,
                subjects=['jobs.*'],  # All job subjects
                retention='WorkQueue',  # Work queue retention policy
                max_consumers=10,
                max_msgs=1000000,
                max_bytes=1024*1024*1024,  # 1GB
                max_age=86400,  # 24 hours
                storage='File',
                replicas=1,
                discard='Old'
            )
            
            # Create stream
            await self.jetstream.add_stream(stream_config)
            logger.info("📊 Stream created", stream=self.STREAM_NAME)
            
        except Exception as error:
            logger.error("❌ Failed to setup stream", error=str(error))
            raise

    async def setup_consumer(self):
        """Create or update the consumer for Python jobs"""
        try:
            # Check if consumer already exists
            try:
                consumer_info = await self.jetstream.consumer_info(self.STREAM_NAME, self.CONSUMER_NAME)
                logger.info("📋 Consumer already exists", 
                           consumer=self.CONSUMER_NAME, 
                           subject=self.PYTHON_JOBS_SUBJECT)
                return
            except Exception:
                # Consumer doesn't exist, create it
                pass
            
            # Create consumer configuration
            consumer_config = ConsumerConfig(
                durable_name=self.CONSUMER_NAME,
                filter_subject=self.PYTHON_JOBS_SUBJECT,
                ack_policy=AckPolicy.EXPLICIT,  # Manual acknowledgment
                max_deliver=3,  # Retry up to 3 times
                ack_wait=30,  # 30 seconds wait for ack
                deliver_policy=DeliverPolicy.ALL,
            )
            
            # Add consumer to stream
            await self.jetstream.add_consumer(self.STREAM_NAME, consumer_config)
            logger.info("📋 Consumer created", 
                       consumer=self.CONSUMER_NAME, 
                       subject=self.PYTHON_JOBS_SUBJECT)
            
        except Exception as error:
            logger.error("❌ Failed to setup consumer", error=str(error))
            raise
    
    def _setup_signal_handlers(self):
        """Setup asyncio-compatible signal handlers for graceful shutdown"""
        loop = asyncio.get_event_loop()
        
        def signal_handler():
            logger.info("🛑 Received shutdown signal, initiating graceful shutdown...")
            self.shutdown_requested = True
            self.running = False
            if self.job_processor:
                self.job_processor.request_shutdown()
        
        loop.add_signal_handler(signal.SIGTERM, signal_handler)
        loop.add_signal_handler(signal.SIGINT, signal_handler)
    
    async def start(self):
        """Start the worker and begin processing jobs"""
        await self.initialize()
        self.running = True
        self._setup_signal_handlers()
        
        logger.info("🚀 Python Worker started, listening for diacritics jobs...")
        
        # Start consuming jobs
        await self.consume_jobs()
    
    async def stop(self):
        """Stop the worker gracefully"""
        logger.info("🛑 Stopping worker gracefully...")
        self.running = False
        self.shutdown_requested = True
        
        # Give current job processing a moment to complete
        await asyncio.sleep(2)
        
        if self.nats_client:
            await self.nats_client.close()
            logger.info("🔌 NATS connection closed")
        
        logger.info("✅ Worker stopped gracefully")
    
    async def consume_jobs(self):
        """Main job consumption loop"""
        try:
            # Get consumer
            consumer = await self.jetstream.consumer_info(self.STREAM_NAME, self.CONSUMER_NAME)
            
            # Subscribe to messages
            subscription = await self.jetstream.pull_subscribe(
                subject=self.PYTHON_JOBS_SUBJECT,
                durable=self.CONSUMER_NAME,
                stream=self.STREAM_NAME
            )
            
            while self.running and not self.shutdown_requested:
                try:
                    # Fetch messages (blocking with timeout)
                    messages = await subscription.fetch(batch=1, timeout=5.0)
                    
                    for msg in messages:
                        # Check for shutdown before processing each message
                        if self.shutdown_requested:
                            logger.info("🛑 Shutdown requested, stopping message processing")
                            await msg.nak()  # Negative acknowledge so message can be reprocessed
                            return  # Exit the entire consume_jobs method
                        await self.process_message(msg)
                        
                except TimeoutError:
                    # No messages available, continue loop
                    continue
                except Exception as error:
                    logger.error("❌ Error fetching messages", error=str(error))
                    await asyncio.sleep(1)  # Brief pause before retrying
                    
        except Exception as error:
            logger.error("❌ Error in job consumption loop", error=str(error))
            if self.running:
                # Restart consumption after a delay
                await asyncio.sleep(5)
                await self.consume_jobs()
    
    async def process_message(self, msg):
        """Process a single job message"""
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Parse job data from NATS message
            message_data = msg.data.decode('utf-8')
            job_message = json.loads(message_data)
            
            # Extract nested job data (API sends nested structure with 'data' property)
            # Handle both nested and flat structures for backward compatibility
            if isinstance(job_message, dict) and 'data' in job_message:
                job_data = job_message['data']
                logger.debug("📦 Extracted nested job data", 
                           job_id=job_message.get('jobId'),
                           job_name=job_message.get('jobName'))
            else:
                job_data = job_message
                logger.debug("📦 Using flat job data structure")
            
            # Extract job type from NATS subject
            job_type = msg.subject.split('.')[-1]  # e.g., 'jobs.python.add-diacritics' -> 'add-diacritics'
            
            logger.info("📥 Processing job", 
                       job_type=job_type,
                       subject=msg.subject,
                       correlation_id=job_data.get('correlationId'),
                       book_id=job_data.get('bookId'))
            
            # Process the job using job processor
            result = await self.job_processor.process_job(job_type, job_data)
            
            # Acknowledge successful processing with retry logic
            ack_success = False
            for attempt in range(3):  # Try up to 3 times
                try:
                    await msg.ack()
                    ack_success = True
                    break
                except Exception as ack_error:
                    logger.warning(f"⚠️ ACK attempt {attempt + 1} failed", extra={
                        "error": str(ack_error),
                        "correlation_id": job_data.get('correlationId'),
                        "attempt": attempt + 1
                    })
                    if attempt < 2:  # Don't sleep on last attempt
                        await asyncio.sleep(0.5)  # Brief pause before retry
            
            if not ack_success:
                logger.error("❌ Failed to acknowledge message after 3 attempts", extra={
                    "correlation_id": job_data.get('correlationId'),
                    "job_type": job_type
                })
                # Don't raise exception - job was processed successfully
            
            duration = asyncio.get_event_loop().time() - start_time
            logger.info("✅ Job completed successfully", extra={
                "job_type": job_type,
                "correlation_id": job_data.get('correlationId'),
                "duration": duration,
                "result": result.get('processed_count', 0),
                "ack_success": ack_success
            })
            
        except Exception as error:
            logger.error("❌ Job processing failed", 
                        subject=msg.subject,
                        error=str(error),
                        stack=str(error.__traceback__))
            
            # Negative acknowledge (will retry based on consumer config)
            await msg.nak()
    

async def main():
    """Main entry point"""
    logger.info("🚀 Starting NATS Python Worker for Audiobook Studio")
    
    worker = NatsPythonWorker()
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
    finally:
        await worker.stop()
        logger.info("👋 Python Worker stopped")

if __name__ == "__main__":
    asyncio.run(main())
