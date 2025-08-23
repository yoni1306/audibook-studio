#!/usr/bin/env python3
"""
Python Worker for Audiobook Studio - Diacritics Processing

This worker connects to the same Redis instance as the JavaScript BullMQ worker
and processes 'add-diacritics' jobs while leaving other job types for the JS worker.
"""

import os
import json
import time
import asyncio
import traceback
from typing import Dict, Any

import redis.asyncio as redis
from dotenv import load_dotenv

from logging_config import get_logger
from services import DatabaseService, DiacriticsService, JobProcessor

# Load environment variables
load_dotenv()

# Configure structured logging
logger = get_logger("python-diacritics-worker")

class BullMQWorker:
    """BullMQ-compatible Python worker for job listening and processing"""
    
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.database_url = os.getenv('DATABASE_URL')
        self.queue_name = 'audio-processing'
        
        self.redis = None
        self.job_processor = None
        self.running = False
    
    async def initialize(self):
        """Initialize all services"""
        logger.info("Initializing Python diacritics worker...")
        
        # Initialize Redis
        self.redis = redis.from_url(self.redis_url, decode_responses=True)
        await self.redis.ping()
        logger.info(f"Connected to Redis: {self.redis_url}")
        
        # Initialize Database
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        logger.info("Initializing database service...")
        db_service = DatabaseService(self.database_url)
        db_service.connect()
        logger.info("Database service connected successfully")
        
        # Initialize Diacritics Service
        logger.info("Initializing diacritics service...")
        diacritics_service = DiacriticsService()
        diacritics_service.initialize()
        logger.info("Diacritics service initialized successfully")
        
        # Initialize Job Processor
        self.job_processor = JobProcessor(db_service, diacritics_service)
        
        logger.info("Python diacritics worker initialized successfully")
    
    async def cleanup(self):
        """Cleanup all services"""
        logger.info("Cleaning up Python worker services...")
        
        if self.job_processor and self.job_processor.db_service:
            self.job_processor.db_service.disconnect()
        
        if self.redis:
            await self.redis.close()
        
        logger.info("Python worker cleanup completed")
    
    async def listen_for_jobs(self):
        """Listen for BullMQ jobs"""
        logger.info(f"Starting to listen for 'add-diacritics' jobs on queue '{self.queue_name}'")
        self.running = True
        
        while self.running:
            try:
                # BullMQ job processing pattern
                # 1. Get a job from the waiting list
                waiting_key = f"bull:{self.queue_name}:waiting"
                active_key = f"bull:{self.queue_name}:active"
                
                # Use BRPOPLPUSH to atomically move job from waiting to active
                job_id = await self.redis.brpoplpush(waiting_key, active_key, timeout=5)
                
                if job_id:
                    try:
                        # Get job data
                        job_key = f"bull:{self.queue_name}:{job_id}"
                        job_data_raw = await self.redis.hget(job_key, "data")
                        
                        if not job_data_raw:
                            logger.warning(f"No data found for job {job_id}")
                            await self.redis.lrem(active_key, 1, job_id)
                            continue
                        
                        job_data = json.loads(job_data_raw)
                        job_name = await self.redis.hget(job_key, "name")
                        
                        # Only process jobs we support
                        if self.job_processor.is_job_supported(job_name):
                            logger.info(f"Processing job {job_id}: {job_name}")
                            
                            # Update job status
                            await self.redis.hset(job_key, "processedOn", int(time.time() * 1000))
                            
                            # Process the job
                            result = await self.job_processor.process_job(job_name, job_data)
                            
                            # Mark job as completed
                            await self.redis.hset(job_key, "returnvalue", json.dumps(result))
                            await self.redis.hset(job_key, "finishedOn", int(time.time() * 1000))
                            
                            # Move job from active to completed
                            await self.redis.lrem(active_key, 1, job_id)
                            completed_key = f"bull:{self.queue_name}:completed"
                            await self.redis.lpush(completed_key, job_id)
                            
                            logger.info(f"Job {job_id} completed successfully")
                            
                        else:
                            # Not our job type, put it back in waiting queue for JS worker
                            await self.redis.lrem(active_key, 1, job_id)
                            await self.redis.rpush(waiting_key, job_id)
                            
                    except Exception as e:
                        logger.error(f"Error processing job {job_id}: {e}")
                        logger.error(traceback.format_exc())
                        
                        # Mark job as failed
                        job_key = f"bull:{self.queue_name}:{job_id}"
                        await self.redis.hset(job_key, "failedReason", str(e))
                        await self.redis.hset(job_key, "finishedOn", int(time.time() * 1000))
                        
                        # Move job from active to failed
                        await self.redis.lrem(active_key, 1, job_id)
                        failed_key = f"bull:{self.queue_name}:failed"
                        await self.redis.lpush(failed_key, job_id)
                        
            except Exception as e:
                if self.running:
                    logger.error(f"Error in job processing loop: {e}")
                    await asyncio.sleep(1)
    
    async def start(self):
        """Start the worker"""
        try:
            await self.initialize()
            await self.listen_for_jobs()
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, shutting down...")
        except Exception as e:
            logger.error(f"Worker error: {e}")
            logger.error(traceback.format_exc())
        finally:
            self.running = False
            await self.cleanup()

async def main():
    """Main entry point"""
    logger.info("Starting Python Diacritics Worker for Audiobook Studio")
    
    worker = BullMQWorker()
    await worker.start()

if __name__ == "__main__":
    asyncio.run(main())
