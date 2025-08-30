"""
Unit test to reproduce and fix the JSON string .get() attribute error bug.

This test reproduces the exact issue where book.processingMetadata is a JSON string
from the database but the code tries to call .get() on it as if it were a dict.
"""

# import pytest  # Not available, using manual testing
import json
from unittest.mock import Mock, MagicMock
from services.job_processor import JobProcessor
from services.database_orm import DatabaseORMService
from services.diacritics import DiacriticsService


class MockBook:
    """Mock book object that simulates database return"""
    def __init__(self, processing_metadata):
        self.processingMetadata = processing_metadata


class TestJobProcessorMetadataBug:
    """Test case that reproduces the JSON string .get() bug"""
    
    def setup_method(self):
        """Setup test fixtures"""
        # Create mock services
        self.mock_db_service = Mock(spec=DatabaseORMService)
        self.mock_diacritics_service = Mock(spec=DiacriticsService)
        
        # Create job processor instance
        self.job_processor = JobProcessor(
            db_service=self.mock_db_service,
            diacritics_service=self.mock_diacritics_service
        )
        
        # Mock job data
        self.job_data = {
            'bookId': 'test-book-123',
            'correlationId': 'test-correlation-456'
        }
        
        # Mock book with JSON string metadata (as returned from database)
        self.metadata_dict = {
            'diacriticsType': 'simple',
            'parsingMethod': 'xhtml-based',
            'averageParagraphsPerPage': 25.08,
            'processedAt': '2025-08-30T00:15:09.648Z'
        }
        self.metadata_json_string = json.dumps(self.metadata_dict)
    
    def test_reproduce_json_string_get_attribute_error(self):
        """
        Test that reproduces the original bug: 'str' object has no attribute 'get'
        
        This test should FAIL before the fix is applied, demonstrating the bug.
        """
        # Setup: Mock book with JSON string metadata (simulates database return)
        mock_book = MockBook(processing_metadata=self.metadata_json_string)
        self.mock_db_service.get_book_by_id.return_value = mock_book
        
        # Mock other dependencies to isolate the bug
        self.mock_db_service.get_paragraphs_for_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content', 'orderIndex': 1, 'pageId': 'page-1'}
        ]
        self.mock_diacritics_service.is_initialized.return_value = True
        self.mock_diacritics_service.add_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content with diacritics', 'success': True}
        ]
        
        # This should raise AttributeError: 'str' object has no attribute 'get'
        # because book.processingMetadata is a JSON string, not a dict
        with pytest.raises(AttributeError, match="'str' object has no attribute 'get'"):
            # Call the method that contains the buggy line:
            # metadata_diacritics_type = book.processingMetadata.get('diacriticsType', 'advanced')
            self.job_processor._process_diacritics_common(
                job_data=self.job_data,
                diacritics_method='advanced'  # This will be overridden by metadata
            )
    
    def test_fixed_json_string_parsing_works_correctly(self):
        """
        Test that verifies the fix works correctly after applying JSON parsing.
        
        This test should PASS after the fix is applied.
        """
        # Setup: Mock book with JSON string metadata (simulates database return)
        mock_book = MockBook(processing_metadata=self.metadata_json_string)
        self.mock_db_service.get_book_by_id.return_value = mock_book
        
        # Mock other dependencies
        self.mock_db_service.get_paragraphs_for_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content', 'orderIndex': 1, 'pageId': 'page-1'}
        ]
        self.mock_diacritics_service.is_initialized.return_value = True
        self.mock_diacritics_service.add_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content with diacritics', 'success': True}
        ]
        
        # This should work correctly after the fix
        result = self.job_processor._process_diacritics_common(
            job_data=self.job_data,
            diacritics_method='advanced'  # Should be overridden to 'simple' from metadata
        )
        
        # Verify the result is successful
        assert result['status'] == 'completed'
        assert result['processed_count'] == 1
        assert result['error_count'] == 0
        
        # Verify that the diacritics method was correctly extracted from JSON metadata
        # The method should have been overridden from 'advanced' to 'simple' based on metadata
        self.mock_diacritics_service.add_diacritics.assert_called_once()
        call_args = self.mock_diacritics_service.add_diacritics.call_args
        # The method parameter should reflect the metadata preference
        assert 'simple' in str(call_args) or call_args[1].get('method') == 'simple'
    
    def test_handles_invalid_json_gracefully(self):
        """Test that invalid JSON metadata is handled gracefully"""
        # Setup: Mock book with invalid JSON string
        mock_book = MockBook(processing_metadata='{"invalid": json}')
        self.mock_db_service.get_book_by_id.return_value = mock_book
        
        # Mock other dependencies
        self.mock_db_service.get_paragraphs_for_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content', 'orderIndex': 1, 'pageId': 'page-1'}
        ]
        self.mock_diacritics_service.is_initialized.return_value = True
        self.mock_diacritics_service.add_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content with diacritics', 'success': True}
        ]
        
        # This should not crash, should fall back to default method
        result = self.job_processor._process_diacritics_common(
            job_data=self.job_data,
            diacritics_method='advanced'
        )
        
        # Should complete successfully with fallback behavior
        assert result['status'] == 'completed'
    
    def test_handles_dict_metadata_correctly(self):
        """Test that dict metadata (non-string) is handled correctly"""
        # Setup: Mock book with dict metadata (edge case)
        mock_book = MockBook(processing_metadata=self.metadata_dict)
        self.mock_db_service.get_book_by_id.return_value = mock_book
        
        # Mock other dependencies
        self.mock_db_service.get_paragraphs_for_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content', 'orderIndex': 1, 'pageId': 'page-1'}
        ]
        self.mock_diacritics_service.is_initialized.return_value = True
        self.mock_diacritics_service.add_diacritics.return_value = [
            {'id': 'para-1', 'content': 'Test content with diacritics', 'success': True}
        ]
        
        # This should work correctly with dict metadata
        result = self.job_processor._process_diacritics_common(
            job_data=self.job_data,
            diacritics_method='advanced'
        )
        
        assert result['status'] == 'completed'


if __name__ == '__main__':
    # Run the test that reproduces the bug
    test_case = TestJobProcessorMetadataBug()
    test_case.setup_method()
    
    print("🧪 Testing bug reproduction...")
    try:
        test_case.test_reproduce_json_string_get_attribute_error()
        print("❌ Bug test should have failed but didn't!")
    except AttributeError as e:
        print(f"✅ Successfully reproduced bug: {e}")
    except Exception as e:
        print(f"⚠️ Unexpected error: {e}")
    
    print("\n🧪 Testing fix...")
    try:
        test_case.test_fixed_json_string_parsing_works_correctly()
        print("✅ Fix test passed!")
    except Exception as e:
        print(f"❌ Fix test failed: {e}")
