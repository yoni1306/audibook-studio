"""
Job processor for handling diacritics processing jobs.
"""

import logging
from typing import Dict, Any, List, Optional

from .database import DatabaseService
from .diacritics import DiacriticsService

logger = logging.getLogger(__name__)


class JobProcessor:
    """Processes diacritics jobs"""
    
    def __init__(self, db_service: DatabaseService, diacritics_service: DiacriticsService):
        self.db_service = db_service
        self.diacritics_service = diacritics_service
    
    async def process_add_diacritics_job(self, job_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process add-diacritics job"""
        book_id = job_data.get('bookId')
        paragraph_ids = job_data.get('paragraphIds')
        correlation_id = job_data.get('correlationId')
        
        if not book_id:
            raise ValueError("bookId is required in job data")
        
        logger.info(f"Starting diacritics processing for book {book_id}, correlation: {correlation_id}")
        
        # Ensure diacritics service is initialized
        if not self.diacritics_service.is_initialized():
            self.diacritics_service.initialize()
        
        # Get paragraphs to process
        paragraphs = self.db_service.get_paragraphs_for_diacritics(book_id, paragraph_ids)
        
        if not paragraphs:
            logger.info(f"No paragraphs found to process for diacritics in book {book_id}")
            return {
                "status": "completed",
                "processed_count": 0,
                "error_count": 0,
                "message": "No paragraphs found"
            }
        
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
                diacritics_results = self.diacritics_service.add_diacritics_batch(texts)
                
                # Update paragraphs with results
                for j, paragraph in enumerate(batch):
                    try:
                        result_text = diacritics_results[j]
                        self.db_service.update_paragraph_content(
                            paragraph['id'], 
                            result_text
                        )
                        processed_count += 1
                    except Exception as e:
                        logger.error(f"Error updating paragraph {paragraph['id']}: {e}")
                        error_count += 1
                
                logger.debug(f"Processed batch {i // batch_size + 1}/{(len(paragraphs) + batch_size - 1) // batch_size}")
                
            except Exception as e:
                logger.error(f"Error processing diacritics batch: {e}")
                error_count += len(batch)
        
        logger.info(f"Diacritics processing completed: {processed_count} processed, {error_count} errors")
        
        return {
            "status": "completed",
            "processed_count": processed_count,
            "error_count": error_count,
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
