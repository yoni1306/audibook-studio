"""
Job processor for handling diacritics processing jobs.
"""

from typing import Dict, Any, List, Optional
import time
import hashlib

from services.database_orm import DatabaseORMService
from .diacritics import DiacriticsService
from logging_config import get_logger

logger = get_logger(__name__)


class JobProcessor:
    """Processes diacritics jobs"""
    
    def __init__(self, db_service: DatabaseORMService, diacritics_service: DiacriticsService):
        self.db_service = db_service
        self.diacritics_service = diacritics_service
        self.processed_jobs = set()  # Track processed job IDs to prevent duplicates
    
    def _generate_job_id(self, book_id: str, correlation_id: str) -> str:
        """Generate a unique job ID for deduplication"""
        job_key = f"{book_id}:{correlation_id}"
        return hashlib.md5(job_key.encode()).hexdigest()
    
    async def process_add_diacritics_job(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process add-diacritics job"""
        book_id = job_data.get('bookId')
        paragraph_ids = job_data.get('paragraphIds')
        correlation_id = job_data.get('correlationId')
        
        if not book_id:
            raise ValueError("bookId is required in job data")
        
        # Generate unique job ID for deduplication
        job_id = self._generate_job_id(book_id, correlation_id or "")
        
        # Check if this job has already been processed
        if job_id in self.processed_jobs:
            logger.info("🔄 Job already processed, skipping duplicate", extra={
                "book_id": book_id,
                "correlation_id": correlation_id,
                "job_id": job_id
            })
            return {
                "status": "skipped",
                "reason": "duplicate_job",
                "processed_count": 0,
                "error_count": 0,
                "book_id": book_id,
                "correlation_id": correlation_id
            }
        
        # Mark job as being processed
        self.processed_jobs.add(job_id)
        
        job_start_time = time.time()
        logger.info("🚀 Starting diacritics processing", extra={
            "book_id": book_id,
            "correlation_id": correlation_id,
            "job_start_time": job_start_time
        })
        
        # Ensure diacritics service is initialized
        if not self.diacritics_service.is_initialized():
            logger.info("🔧 Initializing diacritics service...")
            init_start = time.time()
            self.diacritics_service.initialize()
            init_duration = time.time() - init_start
            logger.info("✅ Diacritics service initialized", extra={
                "initialization_duration_seconds": round(init_duration, 2)
            })
        
        # Get paragraphs to process
        fetch_start = time.time()
        paragraphs = self.db_service.get_paragraphs_for_diacritics(book_id, paragraph_ids)
        fetch_duration = time.time() - fetch_start
        
        if not paragraphs:
            logger.info("ℹ️ No paragraphs found to process for diacritics", extra={
                "book_id": book_id,
                "fetch_duration_seconds": round(fetch_duration, 2)
            })
            return {
                "status": "completed",
                "processed_count": 0,
                "error_count": 0,
                "message": "No paragraphs found",
                "duration_seconds": round(time.time() - job_start_time, 2)
            }
        
        logger.info("📊 Paragraphs loaded for processing", extra={
            "total_paragraphs": len(paragraphs),
            "book_id": book_id,
            "fetch_duration_seconds": round(fetch_duration, 2)
        })
        
        # Process paragraphs in batches
        batch_size = 10
        total_batches = (len(paragraphs) + batch_size - 1) // batch_size
        processed_count = 0
        error_count = 0
        processing_start_time = time.time()
        
        logger.info("🔄 Starting batch processing", extra={
            "total_batches": total_batches,
            "batch_size": batch_size,
            "total_paragraphs": len(paragraphs)
        })
        
        for i in range(0, len(paragraphs), batch_size):
            batch_start_time = time.time()
            batch_num = i // batch_size + 1
            batch = paragraphs[i:i + batch_size]
            
            try:
                # Extract texts for batch processing
                texts = [p['content'] for p in batch]
                
                # Process batch with timing
                diacritics_start = time.time()
                diacritics_results = self.diacritics_service.add_diacritics_batch(texts)
                diacritics_duration = time.time() - diacritics_start
                
                # Update paragraphs with results
                db_update_start = time.time()
                batch_processed = 0
                batch_errors = 0
                
                for j, paragraph in enumerate(batch):
                    try:
                        result_text = diacritics_results[j]
                        self.db_service.update_paragraph_content(
                            paragraph['id'], 
                            result_text
                        )
                        processed_count += 1
                        batch_processed += 1
                    except Exception as e:
                        logger.error("❌ Error updating paragraph", extra={
                            "paragraph_id": paragraph['id'],
                            "error": str(e),
                            "batch_num": batch_num
                        })
                        error_count += 1
                        batch_errors += 1
                
                db_update_duration = time.time() - db_update_start
                batch_total_duration = time.time() - batch_start_time
                progress_percentage = round((batch_num / total_batches) * 100, 1)
                
                logger.info("✅ Batch completed", extra={
                    "batch_num": batch_num,
                    "total_batches": total_batches,
                    "progress_percentage": progress_percentage,
                    "batch_processed": batch_processed,
                    "batch_errors": batch_errors,
                    "batch_size": len(batch),
                    "diacritics_duration_seconds": round(diacritics_duration, 2),
                    "db_update_duration_seconds": round(db_update_duration, 2),
                    "batch_total_duration_seconds": round(batch_total_duration, 2),
                    "total_processed": processed_count,
                    "total_errors": error_count
                })
                
            except Exception as e:
                batch_duration = time.time() - batch_start_time
                logger.error("💥 Batch processing failed", extra={
                    "batch_num": batch_num,
                    "batch_size": len(batch),
                    "error": str(e),
                    "batch_duration_seconds": round(batch_duration, 2)
                })
                error_count += len(batch)
        
        total_duration = time.time() - job_start_time
        processing_duration = time.time() - processing_start_time
        success_rate = round((processed_count / len(paragraphs)) * 100, 1) if len(paragraphs) > 0 else 0
        
        logger.info("🎉 Diacritics processing completed", extra={
            "book_id": book_id,
            "correlation_id": correlation_id,
            "total_paragraphs": len(paragraphs),
            "processed_count": processed_count,
            "error_count": error_count,
            "success_rate_percentage": success_rate,
            "total_duration_seconds": round(total_duration, 2),
            "processing_duration_seconds": round(processing_duration, 2),
            "avg_paragraphs_per_second": round(processed_count / processing_duration, 2) if processing_duration > 0 else 0
        })
        
        return {
            "status": "completed",
            "processed_count": processed_count,
            "error_count": error_count,
            "success_rate_percentage": success_rate,
            "total_duration_seconds": round(total_duration, 2),
            "processing_duration_seconds": round(processing_duration, 2),
            "total_paragraphs": len(paragraphs),
            "book_id": book_id,
            "correlation_id": correlation_id
        }
    
    def get_supported_job_types(self) -> List[str]:
        """Get list of supported job types"""
        return ['add-diacritics']
    
    def is_job_supported(self, job_name: str) -> bool:
        """Check if a job type is supported"""
        return job_name in self.get_supported_job_types()
    
    async def process_job(self, job_name: str, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a job based on its type"""
        logger.info(f"Processing job: {job_name}")
        
        if not self.is_job_supported(job_name):
            raise ValueError(f"Unsupported job type: {job_name}")
        
        if job_name == 'add-diacritics':
            return await self.process_add_diacritics_job(job_data)
        
        # This should never be reached due to the support check above
        raise ValueError(f"Unknown job type: {job_name}")
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get status of all services"""
        return {
            "database_connected": self.db_service.connection is not None,
            "diacritics_service": self.diacritics_service.get_model_info(),
            "supported_jobs": self.get_supported_job_types()
        }
