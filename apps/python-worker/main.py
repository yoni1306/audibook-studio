#!/usr/bin/env python3
"""
Python Worker for Audiobook Studio

This worker handles ML/NLP tasks like Hebrew diacritics processing using the same
BullMQ infrastructure as the JavaScript worker but processes different job types.

Supported job types:
- add-diacritics: Add Hebrew diacritics to book paragraphs
"""

import os
import sys
import asyncio
import logging
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from nats_worker import NatsPythonWorker
import dotenv
import structlog

# Load environment variables
dotenv.load_dotenv()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger("python-worker")

# Global variables for services
phonikud_instance = None
redis_client = None
db_connection = None

class DatabaseService:
    """Database service for PostgreSQL operations"""
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.connection = None
    
    async def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.connection = psycopg2.connect(
                self.connection_string,
                cursor_factory=RealDictCursor
            )
            self.connection.autocommit = True
            logger.info("Connected to PostgreSQL database")
        except Exception as e:
            logger.error("Failed to connect to database", error=str(e))
            raise
    
    async def disconnect(self):
        """Disconnect from database"""
        if self.connection:
            self.connection.close()
            logger.info("Disconnected from database")
    
    async def get_paragraphs_for_diacritics(self, book_id: str, paragraph_ids: Optional[List[str]] = None) -> List[Dict]:
        """Get paragraphs that need diacritics processing"""
        cursor = self.connection.cursor()
        
        try:
            where_conditions = ['"bookId" = %s', "content_with_diacritics IS NULL"]
            params = [book_id]
            
            if paragraph_ids:
                placeholders = ','.join(['%s'] * len(paragraph_ids))
                where_conditions.append(f"id IN ({placeholders})")
                params.extend(paragraph_ids)
            
            query = f"""
                SELECT id, content, "orderIndex", "pageId"
                FROM paragraphs
                WHERE {' AND '.join(where_conditions)}
                ORDER BY "pageId" ASC, "orderIndex" ASC
            """
            
            cursor.execute(query, params)
            return cursor.fetchall()
            
        finally:
            cursor.close()
    
    async def update_paragraph_diacritics(self, paragraph_id: str, content_with_diacritics: str):
        """Update paragraph with diacritics content"""
        cursor = self.connection.cursor()
        
        try:
            cursor.execute("""
                UPDATE paragraphs 
                SET content_with_diacritics = %s, diacritics_processed_at = %s
                WHERE id = %s
            """, (content_with_diacritics, datetime.utcnow(), paragraph_id))
            
        finally:
            cursor.close()

class DiacriticsService:
    """Service for Hebrew diacritics processing using phonikud"""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.getenv('PHONIKUD_MODEL_PATH', './phonikud-1.0.int8.onnx')
        self.phonikud = None
    
    async def initialize(self):
        """Initialize the phonikud model"""
        try:
            if not os.path.exists(self.model_path):
                logger.warning(f"Model file not found at {self.model_path}, using mock implementation")
                self.phonikud = MockPhonikud()
            else:
                from phonikud_onnx import Phonikud
                self.phonikud = Phonikud(self.model_path)
                logger.info("Phonikud model initialized successfully", model_path=self.model_path)
        except Exception as e:
            logger.warning("Failed to initialize phonikud model, using mock", error=str(e))
            self.phonikud = MockPhonikud()
    
    async def add_diacritics_batch(self, texts: List[str]) -> List[str]:
        """Add diacritics to a batch of texts"""
        if not self.phonikud:
            raise RuntimeError("Phonikud service not initialized")
        
        results = []
        for text in texts:
            try:
                result = self.phonikud.add_diacritics(text)
                results.append(result)
            except Exception as e:
                logger.error("Error processing text for diacritics", error=str(e), text_length=len(text))
                results.append(text)  # Return original text on error
        
        return results

class MockPhonikud:
    """Mock phonikud implementation for development/testing"""
    
    def add_diacritics(self, text: str) -> str:
        """Mock implementation that adds a marker to the text"""
        logger.warning("Using mock phonikud implementation")
        return f"[MOCK_DIACRITICS]{text}[/MOCK_DIACRITICS]"

class PythonWorker:
    """Main Python worker class"""
    
    def __init__(self):
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.database_url = os.getenv('DATABASE_URL')
        self.queue_name = 'audio-processing'  # Same queue as JS worker
        
        self.redis_client = None
        self.db_service = None
        self.diacritics_service = None
        self.running = False
    
    async def initialize(self):
        """Initialize all services"""
        logger.info("Initializing Python worker services...")
        
        # Initialize Redis
        self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
        await self.redis_client.ping()
        logger.info("Connected to Redis", redis_url=self.redis_url)
        
        # Initialize Database
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        self.db_service = DatabaseService(self.database_url)
        await self.db_service.connect()
        
        # Initialize Diacritics Service
        self.diacritics_service = DiacriticsService()
        await self.diacritics_service.initialize()
        
        logger.info("Python worker initialized successfully")
    
    async def cleanup(self):
        """Cleanup all services"""
        logger.info("Cleaning up Python worker services...")
        
        if self.db_service:
            await self.db_service.disconnect()
        
        if self.redis_client:
            await self.redis_client.close()
        
        logger.info("Python worker cleanup completed")
    
    async def process_add_diacritics_job(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process add-diacritics job"""
        book_id = job_data.get('bookId')
        paragraph_ids = job_data.get('paragraphIds')
        correlation_id = job_data.get('correlationId')
        
        logger.info("Starting diacritics processing", 
                   book_id=book_id, 
                   paragraph_count=len(paragraph_ids) if paragraph_ids else 'all',
                   correlation_id=correlation_id)
        
        # Get paragraphs to process
        paragraphs = await self.db_service.get_paragraphs_for_diacritics(book_id, paragraph_ids)
        
        if not paragraphs:
            logger.info("No paragraphs found to process for diacritics", book_id=book_id)
            return {"processed_count": 0, "error_count": 0}
        
        logger.info(f"Processing {len(paragraphs)} paragraphs for diacritics")
        
        # Process paragraphs in batches
        batch_size = 10
        processed_count = 0
        error_count = 0
        
        for i in range(0, len(paragraphs), batch_size):
            batch = paragraphs[i:i + batch_size]
            
            try:
                # Extract texts for batch processing
                texts = [p['content'] for p in batch]
                
                # Process batch
                diacritics_results = await self.diacritics_service.add_diacritics_batch(texts)
                
                # Update paragraphs with results
                for j, paragraph in enumerate(batch):
                    try:
                        result_text = diacritics_results[j]
                        await self.db_service.update_paragraph_diacritics(
                            paragraph['id'], 
                            result_text
                        )
                        processed_count += 1
                    except Exception as e:
                        logger.error("Error updating paragraph", 
                                   paragraph_id=paragraph['id'], 
                                   error=str(e))
                        error_count += 1
                
                logger.debug(f"Processed batch {i // batch_size + 1}/{(len(paragraphs) + batch_size - 1) // batch_size}",
                           batch_size=len(batch),
                           processed_count=processed_count,
                           error_count=error_count)
                
            except Exception as e:
                logger.error("Error processing diacritics batch",
                           error=str(e),
                           batch_start=i,
                           batch_size=len(batch))
                error_count += len(batch)
        
        logger.info("Diacritics processing completed",
                   book_id=book_id,
                   total_paragraphs=len(paragraphs),
                   processed_count=processed_count,
                   error_count=error_count)
        
        return {
            "processed_count": processed_count,
            "error_count": error_count,
            "total_paragraphs": len(paragraphs)
        }
    
    async def process_job(self, job_name: str, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a job based on its type"""
        logger.info("Processing job", job_name=job_name, job_data=job_data)
        
        if job_name == 'add-diacritics':
            return await self.process_add_diacritics_job(job_data)
        else:
            raise ValueError(f"Unknown job type: {job_name}")
    
    async def listen_for_jobs(self):
        """Listen for jobs from Redis queue using BullMQ protocol"""
        logger.info("Starting to listen for jobs", queue_name=self.queue_name)
        self.running = True
        
        while self.running:
            try:
                # Simple Redis-based job polling (simplified BullMQ protocol)
                # In production, you might want to use a proper BullMQ Python client
                job_key = f"bull:{self.queue_name}:waiting"
                
                # Block and wait for a job
                result = await self.redis_client.blpop(job_key, timeout=5)
                
                if result:
                    _, job_id = result
                    
                    # Get job data
                    job_data_key = f"bull:{self.queue_name}:{job_id}"
                    job_data_raw = await self.redis_client.hget(job_data_key, "data")
                    
                    if job_data_raw:
                        import json
                        job_data = json.loads(job_data_raw)
                        job_name = job_data.get('name', 'unknown')
                        
                        # Only process jobs we handle
                        if job_name == 'add-diacritics':
                            try:
                                result = await self.process_job(job_name, job_data)
                                logger.info("Job completed successfully", 
                                           job_id=job_id, 
                                           job_name=job_name,
                                           result=result)
                                
                                # Mark job as completed
                                await self.redis_client.hset(job_data_key, "returnvalue", json.dumps(result))
                                await self.redis_client.hset(job_data_key, "finishedOn", str(int(datetime.utcnow().timestamp() * 1000)))
                                
                            except Exception as e:
                                logger.error("Job failed", 
                                           job_id=job_id, 
                                           job_name=job_name,
                                           error=str(e),
                                           traceback=traceback.format_exc())
                                
                                # Mark job as failed
                                await self.redis_client.hset(job_data_key, "failedReason", str(e))
                                await self.redis_client.hset(job_data_key, "finishedOn", str(int(datetime.utcnow().timestamp() * 1000)))
                        else:
                            # Put job back for JS worker to handle
                            await self.redis_client.rpush(job_key, job_id)
                
            except Exception as e:
                if self.running:  # Only log if we're still supposed to be running
                    logger.error("Error in job processing loop", error=str(e))
                    await asyncio.sleep(1)  # Brief pause before retrying
    
    async def start(self):
        """Start the worker"""
        try:
            await self.initialize()
        except Exception as e:
            logger.error("Failed to start worker", error=str(e))
            raise

async def main():
    """Main entry point"""
    logger.info("Starting Python Worker for Audiobook Studio")
    
    worker = NatsPythonWorker()
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
    except Exception as error:
        logger.error("❌ Worker failed", error=str(error))
        raise
    finally:
        await worker.stop()

if __name__ == "__main__":
    asyncio.run(main())
