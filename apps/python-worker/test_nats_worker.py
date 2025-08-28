"""
Tests for NATS Python Worker

This module contains unit tests for the NatsPythonWorker class,
testing NATS JetStream integration and Hebrew diacritics processing.
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from nats_worker import NatsPythonWorker


class TestNatsPythonWorker:
    """Test suite for NatsPythonWorker"""

    @pytest.fixture
    async def worker(self):
        """Create a worker instance for testing"""
        worker = NatsPythonWorker()
        
        # Mock the NATS connection components directly on the worker instance
        mock_nc = AsyncMock()
        mock_nc.close = AsyncMock()
        mock_nc.is_closed = False
        
        mock_jetstream = AsyncMock()
        mock_jetstream.jsm = AsyncMock()
        
        # Set the mocked components on the worker
        worker.nc = mock_nc
        worker.jetstream = mock_jetstream
        worker.jsm = mock_jetstream.jsm()
        
        # Mock the job processor
        worker.job_processor = AsyncMock()
        
        yield worker

    @pytest.fixture
    def mock_nats_connection(self):
        """Mock NATS connection"""
        mock_nc = AsyncMock()
        mock_nc.close = AsyncMock()
        mock_nc.is_closed = False
        return mock_nc

    @pytest.fixture
    def mock_jetstream(self):
        """Mock JetStream context"""
        mock_js = AsyncMock()
        mock_js.pull_subscribe = AsyncMock()
        return mock_js

    @pytest.fixture
    def mock_jsm(self):
        """Mock JetStream Manager"""
        mock_jsm = AsyncMock()
        mock_jsm.stream_info = AsyncMock()
        mock_jsm.add_stream = AsyncMock()
        mock_jsm.consumer_info = AsyncMock()
        mock_jsm.add_consumer = AsyncMock()
        return mock_jsm

    @pytest.fixture
    def mock_message(self):
        """Mock NATS message"""
        mock_msg = MagicMock()
        mock_msg.subject = "jobs.python.add-diacritics"
        mock_msg.data = json.dumps({
            "bookId": "test-book-123",
            "correlationId": "test-correlation-123"
        }).encode()
        mock_msg.ack = AsyncMock()
        mock_msg.nak = AsyncMock()
        mock_msg.metadata = MagicMock()
        mock_msg.metadata.sequence = MagicMock()
        mock_msg.metadata.sequence.stream = 1
        mock_msg.metadata.timestamp = 1234567890
        return mock_msg

    @pytest.mark.asyncio
    async def test_initialization_success(self, worker):
        """Test successful worker initialization"""
        # Worker is already mocked in the fixture
        with patch.object(worker.jetstream, 'jsm') as mock_jsm:
            # Mock stream exists
            mock_jsm.return_value.stream_info.return_value = MagicMock()
            
            await worker.initialize()
            
            assert worker.nc is not None
            assert worker.jetstream is not None
            assert worker.jsm == mock_jsm
            mock_jsm.return_value.stream_info.assert_called_once_with("hebrew-diacritics-jobs")
            mock_jsm.return_value.consumer_info.assert_called_once_with("hebrew-diacritics-jobs", "python-worker")

    @pytest.mark.asyncio
    async def test_initialization_creates_stream(self, worker, mock_nats_connection, mock_jetstream, mock_jsm):
        """Test stream creation when it doesn't exist"""
        with patch('nats.connect', return_value=mock_nats_connection), \
             patch.object(mock_nats_connection, 'jetstream', return_value=mock_jetstream), \
             patch.object(mock_nats_connection, 'jsm', return_value=mock_jsm):
            
            # Mock stream doesn't exist
            from nats.errors import NotFoundError
            mock_jsm.stream_info.side_effect = NotFoundError()
            mock_jsm.add_stream.return_value = MagicMock()
            mock_jsm.consumer_info.return_value = MagicMock()
            
            await worker.initialize()
            
            mock_jsm.add_stream.assert_called_once()
            stream_config = mock_jsm.add_stream.call_args[0][0]
            assert stream_config.name == "hebrew-diacritics-jobs"
            assert "jobs.js.*" in stream_config.subjects
            assert "jobs.python.*" in stream_config.subjects

    @pytest.mark.asyncio
    async def test_initialization_creates_consumer(self, worker, mock_nats_connection, mock_jetstream, mock_jsm):
        """Test consumer creation when it doesn't exist"""
        with patch('nats.connect', return_value=mock_nats_connection), \
             patch.object(mock_nats_connection, 'jetstream', return_value=mock_jetstream), \
             patch.object(mock_nats_connection, 'jsm', return_value=mock_jsm):
            
            # Mock consumer doesn't exist
            from nats.errors import NotFoundError
            mock_jsm.stream_info.return_value = MagicMock()
            mock_jsm.consumer_info.side_effect = NotFoundError()
            mock_jsm.add_consumer.return_value = MagicMock()
            
            await worker.initialize()
            
            mock_jsm.add_consumer.assert_called_once()
            consumer_config = mock_jsm.add_consumer.call_args[0][1]
            assert consumer_config.durable_name == "python-worker"
            assert consumer_config.filter_subject == "jobs.python.*"

    @pytest.mark.asyncio
    async def test_initialization_with_custom_nats_url(self, worker, mock_nats_connection, mock_jetstream, mock_jsm):
        """Test initialization with custom NATS URL"""
        with patch('nats.connect', return_value=mock_nats_connection) as mock_connect, \
             patch.object(mock_nats_connection, 'jetstream', return_value=mock_jetstream), \
             patch.object(mock_nats_connection, 'jsm', return_value=mock_jsm), \
             patch.dict('os.environ', {'NATS_URL': 'nats://custom:4222'}):
            
            mock_jsm.stream_info.return_value = MagicMock()
            mock_jsm.consumer_info.return_value = MagicMock()
            
            await worker.initialize()
            
            mock_connect.assert_called_once_with("nats://custom:4222")

    @pytest.mark.asyncio
    async def test_process_diacritics_job_success(self, worker):
        """Test successful diacritics job processing"""
        job_data = {
            "bookId": "test-book-123",
            "correlationId": "test-correlation-123"
        }
        
        with patch.object(worker, 'add_diacritics_to_book', new_callable=AsyncMock) as mock_add_diacritics:
            mock_add_diacritics.return_value = {
                "processed": True,
                "bookId": "test-book-123",
                "paragraphsProcessed": 5,
                "duration": 2.5
            }
            
            result = await worker.process_diacritics_job(job_data)
            
            assert result["processed"] is True
            assert result["bookId"] == "test-book-123"
            assert result["paragraphsProcessed"] == 5
            mock_add_diacritics.assert_called_once_with("test-book-123")

    @pytest.mark.asyncio
    async def test_process_diacritics_job_error(self, worker):
        """Test diacritics job processing error handling"""
        job_data = {
            "bookId": "test-book-123",
            "correlationId": "test-correlation-123"
        }
        
        with patch.object(worker, 'add_diacritics_to_book', new_callable=AsyncMock) as mock_add_diacritics:
            mock_add_diacritics.side_effect = Exception("Processing failed")
            
            with pytest.raises(Exception, match="Processing failed"):
                await worker.process_diacritics_job(job_data)

    @pytest.mark.asyncio
    async def test_message_processing_success(self, worker, mock_message):
        """Test successful message processing"""
        with patch.object(worker, 'process_diacritics_job', new_callable=AsyncMock) as mock_process:
            mock_process.return_value = {
                "processed": True,
                "bookId": "test-book-123",
                "paragraphsProcessed": 5
            }
            
            await worker.process_message(mock_message)
            
            mock_process.assert_called_once_with({
                "bookId": "test-book-123",
                "correlationId": "test-correlation-123"
            })
            mock_message.ack.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_processing_nested_job_data(self, worker):
        """Test message processing with nested job data structure (as sent by API)"""
        # Create nested job data structure as sent by the API
        nested_job_data = {
            "jobId": "test-job-123",
            "jobName": "add-diacritics",
            "data": {
                "bookId": "book-456",
                "correlationId": "corr-456"
            },
            "correlationId": "corr-456",
            "timestamp": 1640995200000
        }
        
        mock_message = MagicMock()
        mock_message.subject = "jobs.python.add-diacritics"
        mock_message.data = json.dumps(nested_job_data).encode('utf-8')
        mock_message.ack = AsyncMock()
        mock_message.nak = AsyncMock()
        
        with patch.object(worker, 'job_processor') as mock_job_processor:
            mock_job_processor.process_job = AsyncMock(return_value={
                "processed": True,
                "bookId": "book-456",
                "paragraphsProcessed": 10
            })
            
            await worker.process_message(mock_message)
            
            # Verify job processor was called with the extracted nested data
            # (Python worker now extracts nested data like JS worker does)
            mock_job_processor.process_job.assert_called_once_with(
                "add-diacritics", 
                {
                    "bookId": "book-456",
                    "correlationId": "corr-456"
                }
            )
            mock_message.ack.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_processing_flat_job_data(self, worker):
        """Test message processing with flat job data structure (backward compatibility)"""
        # Create flat job data structure
        flat_job_data = {
            "bookId": "book-789",
            "correlationId": "corr-789"
        }
        
        mock_message = MagicMock()
        mock_message.subject = "jobs.python.add-diacritics"
        mock_message.data = json.dumps(flat_job_data).encode('utf-8')
        mock_message.ack = AsyncMock()
        mock_message.nak = AsyncMock()
        
        with patch.object(worker, 'job_processor') as mock_job_processor:
            mock_job_processor.process_job = AsyncMock(return_value={
                "processed": True,
                "bookId": "book-789",
                "paragraphsProcessed": 5
            })
            
            await worker.process_message(mock_message)
            
            mock_job_processor.process_job.assert_called_once_with(
                "add-diacritics", 
                flat_job_data
            )
            mock_message.ack.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_processing_missing_book_id_nested(self, worker):
        """Test message processing with missing bookId in nested structure"""
        # Create nested job data with missing bookId
        invalid_nested_data = {
            "jobId": "test-job-123",
            "jobName": "add-diacritics",
            "data": {
                "correlationId": "corr-999"
                # bookId is missing
            },
            "correlationId": "corr-999",
            "timestamp": 1640995200000
        }
        
        mock_message = MagicMock()
        mock_message.subject = "jobs.python.add-diacritics"
        mock_message.data = json.dumps(invalid_nested_data).encode('utf-8')
        mock_message.ack = AsyncMock()
        mock_message.nak = AsyncMock()
        
        with patch.object(worker, 'job_processor') as mock_job_processor:
            mock_job_processor.process_job = AsyncMock(side_effect=Exception("Missing bookId"))
            
            await worker.process_message(mock_message)
            
            mock_job_processor.process_job.assert_called_once()
            mock_message.nak.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_processing_missing_book_id_flat(self, worker):
        """Test message processing with missing bookId in flat structure"""
        # Create flat job data with missing bookId
        invalid_flat_data = {
            "correlationId": "corr-888"
            # bookId is missing
        }
        
        mock_message = MagicMock()
        mock_message.subject = "jobs.python.add-diacritics"
        mock_message.data = json.dumps(invalid_flat_data).encode('utf-8')
        mock_message.ack = AsyncMock()
        mock_message.nak = AsyncMock()
        
        with patch.object(worker, 'job_processor') as mock_job_processor:
            mock_job_processor.process_job = AsyncMock(side_effect=Exception("Missing bookId"))
            
            await worker.process_message(mock_message)
            
            mock_job_processor.process_job.assert_called_once()
            mock_message.nak.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_processing_invalid_json(self, worker, mock_message):
        """Test message processing with invalid JSON"""
        mock_message.data = b"invalid json"
        
        await worker.process_message(mock_message)
        
        mock_message.nak.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_processing_unknown_subject(self, worker, mock_message):
        """Test message processing with unknown subject"""
        mock_message.subject = "jobs.python.unknown-job"
        
        await worker.process_message(mock_message)
        
        mock_message.nak.assert_called_once()

    @pytest.mark.asyncio
    async def test_message_processing_error(self, worker, mock_message):
        """Test message processing error handling"""
        with patch.object(worker, 'process_diacritics_job', new_callable=AsyncMock) as mock_process:
            mock_process.side_effect = Exception("Processing error")
            
            await worker.process_message(mock_message)
            
            mock_message.nak.assert_called_once()

    @pytest.mark.asyncio
    async def test_consume_jobs_loop(self, worker, mock_jetstream):
        """Test job consumption loop"""
        mock_subscription = AsyncMock()
        mock_jetstream.pull_subscribe.return_value = mock_subscription
        
        # Mock fetch to return messages then timeout
        mock_message = MagicMock()
        mock_subscription.fetch.side_effect = [
            [mock_message],  # First call returns a message
            asyncio.TimeoutError(),  # Second call times out
            [mock_message],  # Third call returns a message
        ]
        
        worker.jetstream = mock_jetstream
        worker.running = True
        
        with patch.object(worker, 'process_message', new_callable=AsyncMock) as mock_process:
            # Run for a short time then stop
            consume_task = asyncio.create_task(worker.consume_jobs())
            await asyncio.sleep(0.1)
            worker.running = False
            
            try:
                await asyncio.wait_for(consume_task, timeout=1.0)
            except asyncio.TimeoutError:
                consume_task.cancel()
            
            # Should have processed at least one message
            assert mock_process.call_count >= 1

    @pytest.mark.asyncio
    async def test_graceful_shutdown(self, worker, mock_nats_connection, mock_jetstream, mock_jsm):
        """Test graceful shutdown"""
        with patch('nats.connect', return_value=mock_nats_connection), \
             patch.object(mock_nats_connection, 'jetstream', return_value=mock_jetstream), \
             patch.object(mock_nats_connection, 'jsm', return_value=mock_jsm):
            
            mock_jsm.stream_info.return_value = MagicMock()
            mock_jsm.consumer_info.return_value = MagicMock()
            
            await worker.initialize()
            
            # Start worker
            worker.running = True
            
            # Shutdown
            await worker.shutdown()
            
            assert worker.running is False
            mock_nats_connection.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_shutdown_without_connection(self, worker):
        """Test shutdown when not connected"""
        # Should not raise an exception
        await worker.shutdown()
        assert worker.running is False

    def test_signal_handlers(self, worker):
        """Test signal handler setup"""
        import signal
        
        with patch('signal.signal') as mock_signal:
            worker.setup_signal_handlers()
            
            # Should register handlers for SIGINT and SIGTERM
            assert mock_signal.call_count == 2
            calls = mock_signal.call_args_list
            signals_registered = [call[0][0] for call in calls]
            assert signal.SIGINT in signals_registered
            assert signal.SIGTERM in signals_registered

    @pytest.mark.asyncio
    async def test_add_diacritics_integration(self, worker):
        """Test integration with diacritics processing"""
        book_id = "test-book-123"
        
        # Mock the actual diacritics processing
        with patch('worker.add_diacritics_to_book', new_callable=AsyncMock) as mock_add_diacritics:
            mock_add_diacritics.return_value = {
                "processed": True,
                "bookId": book_id,
                "paragraphsProcessed": 10,
                "duration": 5.2
            }
            
            result = await worker.add_diacritics_to_book(book_id)
            
            assert result["processed"] is True
            assert result["bookId"] == book_id
            assert result["paragraphsProcessed"] == 10
            mock_add_diacritics.assert_called_once_with(book_id)

    @pytest.mark.asyncio
    async def test_connection_error_handling(self, worker):
        """Test connection error handling"""
        with patch('nats.connect', side_effect=Exception("Connection failed")):
            with pytest.raises(Exception, match="Connection failed"):
                await worker.initialize()

    @pytest.mark.asyncio
    async def test_logging_integration(self, worker):
        """Test structured logging integration"""
        with patch('structlog.get_logger') as mock_get_logger:
            mock_logger = MagicMock()
            mock_get_logger.return_value = mock_logger
            
            # Create new worker to trigger logger setup
            test_worker = NatsPythonWorker()
            
            mock_get_logger.assert_called_once_with("nats_worker")
            assert test_worker.logger == mock_logger


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
