"""
BullMQ-compatible Python Worker

This module implements a Python worker that properly integrates with BullMQ
by following the BullMQ job processing patterns and queue management.
"""

import os
import json
import asyncio
import redis.asyncio as redis
from typing import Dict, Any, Optional
import structlog
from services.job_processor import JobProcessor
from logging_config import setup_logging

# Setup logging
setup_logging()
logger = structlog.get_logger("bullmq-python-worker")


class BullMQPythonWorker:
    """
    BullMQ-compatible Python Worker
    
    This worker follows BullMQ patterns:
    1. Listens on the waiting queue
    2. Moves jobs from waiting -> active -> completed/failed
    3. Handles job data in BullMQ format
    4. Provides proper error handling and logging
    """
    
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.queue_name = "audio-processing-python"
        
        self.redis = None
        self.job_processor = None
        self.running = False
        
        logger.info("🐍 Initializing BullMQ Python Worker", queue=self.queue_name)
    
    async def initialize(self):
        """Initialize Redis connection and job processor"""
        try:
            # Initialize Redis connection
            self.redis = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis.ping()
            logger.info("✅ Connected to Redis", redis_url=self.redis_url)
            
            # Initialize job processor
            self.job_processor = JobProcessor()
            await self.job_processor.initialize()
            logger.info("✅ Job processor initialized")
            
        except Exception as error:
            logger.error("❌ Failed to initialize BullMQ Python Worker", error=str(error))
            raise
    
    async def start(self):
        """Start the worker and begin processing jobs"""
        await self.initialize()
        logger.info("🚀 BullMQ Python Worker started", queue=self.queue_name)
        await self.process_jobs()
    
    async def process_jobs(self):
        """Main job processing loop"""
        self.running = True
        
        while self.running:
            try:
                await self._process_next_job()
            except Exception as error:
                logger.error("💥 Error in job processing loop", error=str(error))
                await asyncio.sleep(1)  # Brief pause before retrying
    
    async def _process_next_job(self):
        """Process the next available job from the queue"""
        try:
            # BullMQ queue keys
            wait_key = f"bull:{self.queue_name}:wait"
            active_key = f"bull:{self.queue_name}:active"
            
            logger.debug(f"🔍 Checking for jobs in {wait_key}")
            
            # Atomically move job from wait to active (blocking operation)
            job_id = await self.redis.brpoplpush(wait_key, active_key, timeout=5)
            
            logger.debug(f"📥 Got job_id: {job_id}")
            
            if not job_id:
                return  # No job available, continue loop
            
            logger.info("📥 Processing job", job_id=job_id, queue=self.queue_name)
            
            # Get job data from Redis
            job_data = await self._get_job_data(job_id)
            if not job_data:
                logger.error("❌ Job data not found", job_id=job_id)
                await self._fail_job(job_id, "Job data not found")
                return
            
            # Process the job
            result = await self._execute_job(job_id, job_data)
            
            # Mark job as completed
            await self._complete_job(job_id, result)
            
        except asyncio.TimeoutError:
            # Normal timeout, continue loop
            pass
        except Exception as error:
            logger.error("💥 Error processing job", error=str(error))
            if 'job_id' in locals():
                await self._fail_job(job_id, str(error))
    
    async def _get_job_data(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job data from Redis"""
        try:
            job_key = f"bull:{self.queue_name}:{job_id}"
            job_hash = await self.redis.hgetall(job_key)
            
            if not job_hash:
                return None
            
            # Parse job data
            job_data = {
                'id': job_id,
                'name': job_hash.get('name'),
                'data': json.loads(job_hash.get('data', '{}')),
                'opts': json.loads(job_hash.get('opts', '{}')),
                'timestamp': job_hash.get('timestamp'),
            }
            
            return job_data
            
        except Exception as error:
            logger.error("❌ Failed to get job data", job_id=job_id, error=str(error))
            return None
    
    async def _execute_job(self, job_id: str, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the job using the job processor"""
        try:
            job_name = job_data.get('name')
            data = job_data.get('data', {})
            
            logger.info("🔄 Executing job", job_id=job_id, job_name=job_name)
            
            # Process the job
            result = await self.job_processor.process_job(job_name, data)
            
            logger.info("✅ Job completed successfully", job_id=job_id, job_name=job_name)
            return result
            
        except Exception as error:
            logger.error("❌ Job execution failed", job_id=job_id, error=str(error))
            raise
    
    async def _complete_job(self, job_id: str, result: Dict[str, Any]):
        """Mark job as completed and clean up"""
        try:
            # Remove from active queue
            active_key = f"bull:{self.queue_name}:active"
            await self.redis.lrem(active_key, 1, job_id)
            
            # Add to completed queue with timestamp
            completed_key = f"bull:{self.queue_name}:completed"
            timestamp = int(asyncio.get_event_loop().time() * 1000)
            await self.redis.zadd(completed_key, {job_id: timestamp})
            
            # Update job with completion data
            job_key = f"bull:{self.queue_name}:{job_id}"
            await self.redis.hset(job_key, mapping={
                'finishedOn': str(timestamp),
                'processedOn': str(timestamp),
                'returnvalue': json.dumps(result)
            })
            
            logger.info("✅ Job marked as completed", job_id=job_id)
            
        except Exception as error:
            logger.error("❌ Failed to complete job", job_id=job_id, error=str(error))
    
    async def _fail_job(self, job_id: str, error_message: str):
        """Mark job as failed and clean up"""
        try:
            # Remove from active queue
            active_key = f"bull:{self.queue_name}:active"
            await self.redis.lrem(active_key, 1, job_id)
            
            # Add to failed queue with timestamp
            failed_key = f"bull:{self.queue_name}:failed"
            timestamp = int(asyncio.get_event_loop().time() * 1000)
            await self.redis.zadd(failed_key, {job_id: timestamp})
            
            # Update job with failure data
            job_key = f"bull:{self.queue_name}:{job_id}"
            await self.redis.hset(job_key, mapping={
                'failedReason': error_message,
                'finishedOn': str(timestamp),
                'processedOn': str(timestamp)
            })
            
            logger.error("❌ Job marked as failed", job_id=job_id, error=error_message)
            
        except Exception as error:
            logger.error("💥 Failed to fail job", job_id=job_id, error=str(error))
    
    async def stop(self):
        """Stop the worker gracefully"""
        logger.info("🛑 Stopping BullMQ Python Worker...")
        self.running = False
        
        if self.job_processor:
            await self.job_processor.cleanup()
        
        if self.redis:
            await self.redis.close()
        
        logger.info("✅ BullMQ Python Worker stopped")


async def main():
    """Main entry point"""
    worker = BullMQPythonWorker()
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("🔄 Received shutdown signal")
    finally:
        await worker.stop()


if __name__ == "__main__":
    asyncio.run(main())
