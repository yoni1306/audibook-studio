"""
Job processor for handling diacritics processing jobs.
"""

from typing import Dict, Any, List, Optional
import time
import hashlib
import json

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
        self.shutdown_requested = False  # Track shutdown requests
    
    def _generate_job_id(self, book_id: str, correlation_id: str) -> str:
        """Generate a unique job ID for deduplication"""
        job_key = f"{book_id}:{correlation_id}"
        return hashlib.md5(job_key.encode()).hexdigest()
    
    async def process_add_diacritics_job(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process add-diacritics job"""
        logger.info(f"🔍 [JOB PROCESSOR DEBUG] Received job_data type: {type(job_data)}")
        logger.info(f"🔍 [JOB PROCESSOR DEBUG] job_data content: {job_data}")
        
        # Debug: Check if job_data is actually a dict
        if isinstance(job_data, str):
            logger.error(f"❌ job_data is a string, not a dict: {job_data}")
            import json
            try:
                job_data = json.loads(job_data)
                logger.info("✅ Successfully parsed job_data from string to dict")
            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse job_data as JSON: {e}")
                raise ValueError(f"Invalid job_data format: {job_data}")
        
        logger.info("🔍 [JOB PROCESSOR DEBUG] About to call job_data.get('bookId')")
        book_id = job_data.get('bookId')
        logger.info(f"🔍 [JOB PROCESSOR DEBUG] Got book_id: {book_id}")
        
        logger.info("🔍 [JOB PROCESSOR DEBUG] About to call job_data.get('paragraphIds')")
        paragraph_ids = job_data.get('paragraphIds')
        logger.info(f"🔍 [JOB PROCESSOR DEBUG] Got paragraph_ids: {paragraph_ids}")
        
        logger.info("🔍 [JOB PROCESSOR DEBUG] About to call job_data.get('correlationId')")
        correlation_id = job_data.get('correlationId')
        logger.info(f"🔍 [JOB PROCESSOR DEBUG] Got correlation_id: {correlation_id}")
        
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
    
    async def _process_diacritics_job_common(
        self, 
        job_data: Dict[str, Any], 
        job_type: str,
        diacritics_method: str,
        mark_matres_lectionis: Optional[bool] = None
    ) -> Dict[str, Any]:
        """Common diacritics job processing logic"""
        book_id = job_data.get('bookId')
        correlation_id = job_data.get('correlationId')
        job_start_time = time.time()
        
        # Retrieve book metadata to determine actual diacritics type
        book = self.db_service.get_book_by_id(book_id)
        if book and book.processingMetadata:
            # Parse processingMetadata if it's a JSON string
            try:
                if isinstance(book.processingMetadata, str):
                    metadata = json.loads(book.processingMetadata)
                else:
                    metadata = book.processingMetadata
                metadata_diacritics_type = metadata.get('diacriticsType', 'advanced')
                # Override the diacritics_method based on stored preference
                if metadata_diacritics_type == 'simple':
                    diacritics_method = 'simple'
                    job_type = 'simple'
                else:
                    diacritics_method = 'advanced'
                    job_type = 'advanced'
            except (json.JSONDecodeError, AttributeError) as e:
                logger.warning(f"Failed to parse book metadata: {e}")
                # Keep default diacritics_method
            
            logger.info(f"📋 Using diacritics type from book metadata: {metadata_diacritics_type}", extra={
                "book_id": book_id,
                "correlation_id": correlation_id,
                "diacritics_method": diacritics_method,
                "job_type": job_type
            })
        
        # Generate unique job ID for deduplication
        job_id = self._generate_job_id(book_id, correlation_id)
        
        # Check if job was already processed
        if job_id in self.processed_jobs:
            logger.info("🔄 Job already processed, skipping duplicate", extra={
                "book_id": book_id,
                "correlation_id": correlation_id,
                "job_id": job_id,
                "job_type": job_type
            })
            return {
                "status": "completed",
                "processed_count": 0,
                "error_count": 0,
                "message": "Job already processed",
                "duration_seconds": round(time.time() - job_start_time, 2)
            }
        
        logger.info(f"🚀 Starting {job_type} diacritics processing", extra={
            "book_id": book_id,
            "correlation_id": correlation_id,
            "job_start_time": job_start_time
        })
        
        # Fetch paragraphs for processing
        fetch_start = time.time()
        paragraphs = self.db_service.get_paragraphs_for_diacritics(book_id)
        fetch_duration = time.time() - fetch_start
        
        if not paragraphs:
            logger.info(f"ℹ️ No paragraphs found to process for {job_type} diacritics", extra={
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
        
        logger.info(f"📊 Paragraphs loaded for {job_type} diacritics processing", extra={
            "total_paragraphs": len(paragraphs),
            "book_id": book_id,
            "fetch_duration_seconds": round(fetch_duration, 2)
        })
        
        if job_type == "advanced":
            logger.info("📝 Diacritics processing configuration", extra={
                "mark_matres_lectionis": mark_matres_lectionis,
                "mark_matres_lectionis_type": type(mark_matres_lectionis).__name__,
                "book_id": book_id,
                "correlation_id": correlation_id
            })
        
        # Process paragraphs in batches
        batch_size = 10
        total_batches = (len(paragraphs) + batch_size - 1) // batch_size
        processed_count = 0
        error_count = 0
        batch_count = 0
        
        for i in range(0, len(paragraphs), batch_size):
            # Check for shutdown request before processing each batch
            if self.shutdown_requested:
                logger.info("🛑 Shutdown requested, stopping batch processing", extra={
                    "processed_batches": batch_count,
                    "total_batches": total_batches,
                    "processed_paragraphs": processed_count
                })
                break
                
            batch_start_time = time.time()
            batch = paragraphs[i:i + batch_size]
            batch_count += 1
            batch_num = batch_count
            
            # Extract texts for diacritics processing
            texts = [p['content'] for p in batch]
            
            # Process batch through appropriate diacritics service method
            try:
                if diacritics_method == "advanced":
                    diacritics_results = self.diacritics_service.add_advanced_diacritics_batch(texts, mark_matres_lectionis=mark_matres_lectionis)
                elif diacritics_method == "simple":
                    diacritics_results = self.diacritics_service.add_simple_diacritics_batch(texts)
                else:
                    raise ValueError(f"Unknown diacritics method: {diacritics_method}")
                    
                diacritics_duration = time.time() - batch_start_time
                
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
                
                # Log batch completion with page and paragraph info
                progress_percentage = round((batch_count / total_batches) * 100, 1)
                
                # Extract page and paragraph info from current batch
                batch_page_ids = [p.get('pageId') for p in batch if p.get('pageId')]
                unique_pages = list(set(batch_page_ids))
                paragraph_ids = [p.get('id') for p in batch if p.get('id')]
                
                logger.info(f"✅ {job_type.title()} diacritics batch completed", extra={
                    "batch_num": batch_num,
                    "total_batches": total_batches,
                    "progress_percentage": progress_percentage,
                    "batch_processed": batch_processed,
                    "batch_errors": batch_errors,
                    "batch_size": len(batch),
                    "pages_in_batch": len(unique_pages),
                    "page_ids": unique_pages[:5] if len(unique_pages) <= 5 else unique_pages[:5] + ["..."],
                    "paragraph_ids": paragraph_ids[:3] if len(paragraph_ids) <= 3 else paragraph_ids[:3] + ["..."],
                    "diacritics_duration_seconds": round(diacritics_duration, 2),
                    "db_update_duration_seconds": round(db_update_duration, 2),
                    "batch_total_duration_seconds": round(batch_total_duration, 2),
                    "total_processed": processed_count,
                    "total_errors": error_count
                })
                
            except Exception as e:
                logger.error(f"❌ Error processing {job_type} diacritics batch", extra={
                    "batch_num": batch_num,
                    "error": str(e),
                    "batch_size": len(batch)
                })
                error_count += len(batch)
        
        # Mark job as processed
        self.processed_jobs.add(job_id)
        
        # Calculate final metrics
        total_duration = time.time() - job_start_time
        processing_duration = total_duration - fetch_duration
        success_rate = round((processed_count / len(paragraphs)) * 100, 1) if paragraphs else 0
        
        logger.info(f"🎉 {job_type.title()} diacritics processing completed", extra={
            "book_id": book_id,
            "correlation_id": correlation_id,
            "total_paragraphs": len(paragraphs),
            "processed_count": processed_count,
            "error_count": error_count,
            "success_rate_percentage": success_rate,
            "total_duration_seconds": round(total_duration, 2),
            "processing_duration_seconds": round(processing_duration, 2)
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
    
    async def process_add_diacritics_job(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process add-advanced-diacritics job using phonikud model"""
        return await self._process_diacritics_job_common(
            job_data=job_data,
            job_type="advanced",
            diacritics_method="advanced"
        )
    
    async def process_add_simple_diacritics_job(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process add-simple-diacritics job using dicta model"""
        # Debug: Check if job_data is actually a dict
        if isinstance(job_data, str):
            logger.error(f"❌ job_data is a string, not a dict: {job_data}")
            import json
            try:
                job_data = json.loads(job_data)
                logger.info("✅ Successfully parsed job_data from string to dict")
            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse job_data as JSON: {e}")
                raise ValueError(f"Invalid job_data format: {job_data}")
        
        return await self._process_diacritics_job_common(
            job_data=job_data,
            job_type="simple",
            diacritics_method="simple"
        )
    
    def get_supported_job_types(self) -> List[str]:
        """Get list of supported job types"""
        return ['add-advanced-diacritics', 'add-simple-diacritics']
    
    def is_job_supported(self, job_name: str) -> bool:
        """Check if a job type is supported"""
        return job_name in self.get_supported_job_types()
    
    async def process_job(self, job_name: str, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a job based on its type"""
        logger.info(f"Processing job: {job_name}")
        
        if not self.is_job_supported(job_name):
            raise ValueError(f"Unsupported job type: {job_name}")
        
        if job_name == 'add-advanced-diacritics':
            return await self.process_add_diacritics_job(job_data)
        elif job_name == 'add-simple-diacritics':
            return await self.process_add_simple_diacritics_job(job_data)
        
        # This should never be reached due to the support check above
        raise ValueError(f"Unknown job type: {job_name}")
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get status of all services"""
        return {
            "database_connected": self.db_service.connection is not None,
            "diacritics_service": self.diacritics_service.get_model_info(),
            "supported_jobs": self.get_supported_job_types()
        }
