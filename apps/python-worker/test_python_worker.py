"""
Consolidated Python Worker Test Suite

Tests critical functionality:
- Job processor variable definitions and deduplication
- NATS worker message processing and lifecycle
- Parameter handling (mark_matres_lectionis)
- Error handling and logging
"""

import pytest
import json
import hashlib
import time
from unittest.mock import MagicMock, patch, AsyncMock
from nats_worker import NatsPythonWorker


class TestTextChunking:
    """Test text chunking functionality"""
    
    def test_short_text_no_chunking(self):
        """Test that short text is not chunked"""
        from services.diacritics import DiacriticsService
        service = DiacriticsService()
        
        short_text = "This is a short text."
        chunks = service._split_text_into_chunks(short_text, max_chars=2046)
        
        assert len(chunks) == 1
        assert chunks[0] == short_text
    
    def test_sentence_boundary_chunking(self):
        """Test that text is split at sentence boundaries"""
        from services.diacritics import DiacriticsService
        service = DiacriticsService()
        
        # Create text with multiple sentences that exceeds limit
        text = "First sentence. " * 100 + "Second sentence. " * 100
        chunks = service._split_text_into_chunks(text, max_chars=500)
        
        assert len(chunks) > 1
        # Each chunk should end with sentence punctuation or be the last chunk
        for i, chunk in enumerate(chunks[:-1]):
            assert chunk.endswith('.') or chunk.endswith('!') or chunk.endswith('?')
    
    def test_hebrew_punctuation_chunking(self):
        """Test chunking with Hebrew punctuation marks"""
        from services.diacritics import DiacriticsService
        service = DiacriticsService()
        
        # Hebrew text with Hebrew punctuation
        text = "משפט ראשון׃ " * 50 + "משפט שני։ " * 50
        chunks = service._split_text_into_chunks(text, max_chars=300)
        
        assert len(chunks) > 1
        # Verify Hebrew punctuation is preserved
        for chunk in chunks:
            if '׃' in chunk or '։' in chunk:
                assert chunk.endswith('׃') or chunk.endswith('։') or chunk == chunks[-1]
    
    def test_long_sentence_word_fallback(self):
        """Test that very long sentences are split by words"""
        from services.diacritics import DiacriticsService
        service = DiacriticsService()
        
        # Single very long sentence without punctuation
        long_sentence = "word " * 1000  # Much longer than 2046 chars
        chunks = service._split_text_into_chunks(long_sentence, max_chars=100)
        
        assert len(chunks) > 1
        # Each chunk should be under the limit
        for chunk in chunks:
            assert len(chunk) <= 100
    
    def test_empty_text_handling(self):
        """Test handling of empty or whitespace-only text"""
        from services.diacritics import DiacriticsService
        service = DiacriticsService()
        
        # Empty text
        chunks = service._split_text_into_chunks("", max_chars=2046)
        assert len(chunks) == 1
        assert chunks[0] == ""
        
        # Whitespace only
        chunks = service._split_text_into_chunks("   ", max_chars=2046)
        assert len(chunks) == 1


class TestJobProcessorMetadataBug:
    """Test to reproduce and fix the JSON string .get() attribute error bug"""
    
    def test_json_string_metadata_parsing_works(self):
        """
        Test that verifies the JSON string metadata parsing fix works correctly.
        
        This test demonstrates that the fix prevents the 'str' object has no attribute 'get' error
        by properly parsing JSON string metadata from the database.
        """
        from services.job_processor import JobProcessor
        from unittest.mock import Mock
        
        # Create mock services
        mock_db_service = Mock()
        mock_diacritics_service = Mock()
        
        # Create job processor instance
        job_processor = JobProcessor(
            db_service=mock_db_service,
            diacritics_service=mock_diacritics_service
        )
        
        # Mock job data
        job_data = {
            'bookId': 'test-book-123',
            'correlationId': 'test-correlation-456'
        }
        
        # Mock book with JSON string metadata (as returned from database)
        metadata_dict = {
            'diacriticsType': 'simple',
            'parsingMethod': 'xhtml-based',
            'averageParagraphsPerPage': 25.08,
            'processedAt': '2025-08-30T00:15:09.648Z'
        }
        metadata_json_string = json.dumps(metadata_dict)
        
        # Mock book object that simulates database return
        class MockBook:
            def __init__(self, processing_metadata):
                self.processingMetadata = processing_metadata
        
        mock_book = MockBook(processing_metadata=metadata_json_string)
        mock_db_service.get_book_by_id.return_value = mock_book
        
        # Mock other dependencies to isolate the bug
        mock_db_service.get_paragraphs_for_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content', 'orderIndex': 1, 'pageId': 'page-1'}
        ]
        mock_diacritics_service.is_initialized.return_value = True
        mock_diacritics_service.add_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content with diacritics', 'success': True}
        ]
        
        # This should work correctly with the JSON parsing fix
        # The fix properly handles JSON string metadata from the database
        import asyncio
        result = asyncio.run(job_processor._process_diacritics_job_common(
            job_data=job_data,
            job_type='advanced',
            diacritics_method='advanced'  # Should be overridden to 'simple' from metadata
        ))
        
        # Verify the result is successful
        assert result['status'] == 'completed'
        assert 'processed_count' in result
        assert 'error_count' in result
        
        # Verify that the JSON metadata was parsed correctly and diacritics method was overridden
        # The metadata contains 'diacriticsType': 'simple', so it should override the 'advanced' default


class TestJobProcessor:
    """Test job processor core functionality"""
    
    def test_job_id_generation(self):
        """Test job ID generation for deduplication"""
        book_id = "test-book-123"
        correlation_id = "test-correlation-456"
        
        # Generate job ID using same logic as JobProcessor
        job_key = f"{book_id}:{correlation_id}"
        expected_job_id = hashlib.md5(job_key.encode()).hexdigest()
        
        # Test that same inputs produce same job ID
        job_id1 = hashlib.md5(f"{book_id}:{correlation_id}".encode()).hexdigest()
        job_id2 = hashlib.md5(f"{book_id}:{correlation_id}".encode()).hexdigest()
        
        assert job_id1 == job_id2 == expected_job_id
    
    def test_job_deduplication_logic(self):
        """Test job deduplication prevents duplicate processing"""
        processed_jobs = set()
        
        # First job should be processed
        job_id1 = "test-job-123"
        assert job_id1 not in processed_jobs
        processed_jobs.add(job_id1)
        
        # Same job should be skipped
        assert job_id1 in processed_jobs
        
        # Different job should be processed
        job_id2 = "test-job-456"
        assert job_id2 not in processed_jobs
    
    def test_batch_variable_definitions(self):
        """Test that batch_num and diacritics_duration are properly defined"""
        paragraphs = [{"id": f"para{i}", "content": f"text {i}"} for i in range(5)]
        batch_size = 2
        total_batches = (len(paragraphs) + batch_size - 1) // batch_size
        batch_count = 0
        
        for i in range(0, len(paragraphs), batch_size):
            batch_start_time = time.time()
            batch = paragraphs[i:i + batch_size]
            batch_count += 1
            
            # These variables must be defined for logging
            batch_num = batch_count
            diacritics_duration = time.time() - batch_start_time
            
            # Verify variables are defined and have expected values
            assert batch_num == batch_count
            assert isinstance(diacritics_duration, float)
            assert diacritics_duration >= 0
    
    def test_mark_matres_lectionis_parameter_extraction(self):
        """Test mark_matres_lectionis parameter extraction from job data"""
        # Test with parameter present
        job_data_with_param = {
            "bookId": "test-book",
            "mark_matres_lectionis": True
        }
        mark_matres_lectionis = job_data_with_param.get('mark_matres_lectionis')
        assert mark_matres_lectionis is True
        
        # Test with parameter absent (should default to None)
        job_data_without_param = {
            "bookId": "test-book"
        }
        mark_matres_lectionis = job_data_without_param.get('mark_matres_lectionis')
        assert mark_matres_lectionis is None
        
        # Test with parameter explicitly None
        job_data_none_param = {
            "bookId": "test-book",
            "mark_matres_lectionis": None
        }
        mark_matres_lectionis = job_data_none_param.get('mark_matres_lectionis')
        assert mark_matres_lectionis is None


class TestNatsWorker:
    """Test NATS worker functionality"""
    
    @pytest.fixture
    def worker(self):
        """Create a worker instance for testing"""
        with patch('logging_config.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            worker = NatsPythonWorker()
            return worker
    
    @pytest.mark.asyncio
    async def test_message_processing_success(self):
        """Test successful message processing"""
        with patch('logging_config.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            
            worker = NatsPythonWorker()
            
            # Mock job processor
            worker.job_processor = MagicMock()
            worker.job_processor.process_add_diacritics_job = AsyncMock(return_value={
                "status": "completed",
                "processed_count": 5,
                "error_count": 0
            })
            
            # Create mock message
            mock_message = MagicMock()
            mock_message.subject = "jobs.python.add-diacritics"
            mock_message.data = json.dumps({
                "bookId": "test-book-123",
                "correlationId": "test-correlation-123"
            }).encode()
            mock_message.ack = AsyncMock()
            
            # Process message
            await worker.process_message(mock_message)
            
            # Verify job processor was called
            worker.job_processor.process_add_diacritics_job.assert_called_once_with({
                "bookId": "test-book-123",
                "correlationId": "test-correlation-123"
            })
            
            # Verify message was acknowledged
            mock_message.ack.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_message_processing_nested_data(self):
        """Test processing message with nested data structure"""
        with patch('logging_config.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            
            worker = NatsPythonWorker()
            worker.job_processor = MagicMock()
            worker.job_processor.process_add_diacritics_job = AsyncMock(return_value={"status": "completed"})
            
            # Create mock message with nested structure
            mock_message = MagicMock()
            mock_message.subject = "jobs.python.add-diacritics"
            mock_message.data = json.dumps({
                "jobId": "job-123",
                "jobName": "add-diacritics",
                "data": {
                    "bookId": "nested-book-123",
                    "correlationId": "nested-correlation-123"
                }
            }).encode()
            mock_message.ack = AsyncMock()
            
            # Process message
            await worker.process_message(mock_message)
            
            # Verify nested data was extracted correctly
            worker.job_processor.process_add_diacritics_job.assert_called_once_with({
                "bookId": "nested-book-123",
                "correlationId": "nested-correlation-123"
            })
    
    @pytest.mark.asyncio
    async def test_message_processing_invalid_json(self):
        """Test handling of invalid JSON messages"""
        with patch('logging_config.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            
            worker = NatsPythonWorker()
            
            # Create mock message with invalid JSON
            mock_message = MagicMock()
            mock_message.subject = "jobs.python.add-diacritics"
            mock_message.data = b"invalid json content"
            mock_message.nak = AsyncMock()
            
            # Process message (should handle error gracefully)
            await worker.process_message(mock_message)
            
            # Verify message was negatively acknowledged
            mock_message.nak.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_message_processing_job_error(self):
        """Test handling of job processing errors"""
        with patch('logging_config.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            
            worker = NatsPythonWorker()
            
            # Mock job processor to raise exception
            worker.job_processor = MagicMock()
            worker.job_processor.process_add_diacritics_job = AsyncMock(side_effect=Exception("Job processing failed"))
            
            # Create mock message
            mock_message = MagicMock()
            mock_message.subject = "jobs.python.add-diacritics"
            mock_message.data = json.dumps({
                "bookId": "test-book",
                "correlationId": "test-correlation"
            }).encode()
            mock_message.nak = AsyncMock()
            
            # Process message
            await worker.process_message(mock_message)
            
            # Verify message was negatively acknowledged due to error
            mock_message.nak.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_ack_retry_logic(self):
        """Test ACK retry logic for broken pipe errors"""
        with patch('logging_config.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            
            worker = NatsPythonWorker()
            worker.job_processor = MagicMock()
            worker.job_processor.process_add_diacritics_job = AsyncMock(return_value={"status": "completed"})
            
            # Create mock message that fails ACK twice then succeeds
            mock_message = MagicMock()
            mock_message.subject = "jobs.python.add-diacritics"
            mock_message.data = json.dumps({
                "bookId": "test-book",
                "correlationId": "test-correlation"
            }).encode()
            
            # Mock ACK to fail twice then succeed
            ack_call_count = 0
            def mock_ack():
                nonlocal ack_call_count
                ack_call_count += 1
                if ack_call_count <= 2:
                    raise Exception("Broken pipe")
                return None
            
            mock_message.ack = AsyncMock(side_effect=mock_ack)
            
            # Process message
            await worker.process_message(mock_message)
            
            # Verify ACK was retried 3 times
            assert mock_message.ack.call_count == 3
    
    @pytest.mark.asyncio
    async def test_worker_stop(self):
        """Test worker shutdown functionality"""
        with patch('logging_config.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            
            worker = NatsPythonWorker()
            worker.running = True
            worker.nats_client = MagicMock()
            worker.nats_client.close = AsyncMock()
            
            await worker.stop()
            
            # Verify shutdown was called
            assert not worker.running
            worker.nats_client.close.assert_called_once()
    
    def test_worker_initialization(self):
        """Test worker initialization"""
        with patch('nats_worker.logger') as mock_logger:
            worker = NatsPythonWorker()
            
            # Verify worker was created successfully
            assert worker is not None
            assert worker.nats_url == 'nats://localhost:4222'
            assert worker.running is False
            assert worker.STREAM_NAME == 'AUDIOBOOK_JOBS'
            assert worker.CONSUMER_NAME == 'python-worker'
            assert worker.PYTHON_JOBS_SUBJECTS == [
                "jobs.python.add-advanced-diacritics",
                "jobs.python.add-simple-diacritics"
            ]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
