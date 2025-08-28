"""
Unit tests to verify database schema fixes for Python worker.
Tests that SQL queries use correct column names (pageId, bookId, orderIndex).
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from services.database import DatabaseService


class TestDatabaseSchemaFix(unittest.TestCase):
    """Test database schema fixes"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.db_service = DatabaseService("postgresql://test:test@localhost:5432/test")
        self.db_service.connection = Mock()
        
    def test_get_paragraphs_for_diacritics_uses_correct_columns(self):
        """Test that get_paragraphs_for_diacritics uses correct column names"""
        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = [
            {'id': '1', 'content': 'test', 'orderIndex': 1, 'pageId': 'page1'}
        ]
        self.db_service.connection.cursor.return_value = mock_cursor
        
        # Call the method
        result = self.db_service.get_paragraphs_for_diacritics('book123')
        
        # Verify the SQL query uses correct column names
        mock_cursor.execute.assert_called_once()
        sql_query = mock_cursor.execute.call_args[0][0]
        
        # Check that the query uses camelCase column names
        self.assertIn('"bookId"', sql_query)
        self.assertIn('"pageId"', sql_query)
        self.assertIn('"orderIndex"', sql_query)
        
        # Check that it doesn't use snake_case column names
        self.assertNotIn('book_id', sql_query)
        self.assertNotIn('page_id', sql_query)
        self.assertNotIn('order_index', sql_query)
        
        # Verify ORDER BY clause uses correct columns
        self.assertIn('ORDER BY "pageId" ASC, "orderIndex" ASC', sql_query)
        
    def test_get_paragraph_by_id_uses_correct_columns(self):
        """Test that get_paragraph_by_id uses correct column names"""
        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.fetchone.return_value = {
            'id': '1', 'content': 'test', 'orderIndex': 1, 'pageId': 'page1', 'bookId': 'book1'
        }
        self.db_service.connection.cursor.return_value = mock_cursor
        
        # Call the method
        result = self.db_service.get_paragraph_by_id('para123')
        
        # Verify the SQL query uses correct column names
        mock_cursor.execute.assert_called_once()
        sql_query = mock_cursor.execute.call_args[0][0]
        
        # Check that the query uses camelCase column names
        self.assertIn('"orderIndex"', sql_query)
        self.assertIn('"pageId"', sql_query)
        self.assertIn('"bookId"', sql_query)
        
        # Check that it doesn't use snake_case column names
        self.assertNotIn('order_index', sql_query)
        self.assertNotIn('page_id', sql_query)
        self.assertNotIn('book_id', sql_query)
        
    def test_get_book_paragraph_count_uses_correct_columns(self):
        """Test that get_book_paragraph_count uses correct column names"""
        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.fetchone.return_value = {'count': 5}
        self.db_service.connection.cursor.return_value = mock_cursor
        
        # Call the method
        result = self.db_service.get_book_paragraph_count('book123')
        
        # Verify the SQL query uses correct column names
        mock_cursor.execute.assert_called_once()
        sql_query = mock_cursor.execute.call_args[0][0]
        
        # Check that the query uses camelCase column names
        self.assertIn('"bookId"', sql_query)
        
        # Check that it doesn't use snake_case column names
        self.assertNotIn('book_id', sql_query)
        
        # Verify result
        self.assertEqual(result, 5)
        
    def test_get_paragraphs_with_paragraph_ids_filter(self):
        """Test that paragraph ID filtering works with correct column names"""
        # Mock cursor
        mock_cursor = Mock()
        mock_cursor.fetchall.return_value = []
        self.db_service.connection.cursor.return_value = mock_cursor
        
        # Call the method with paragraph IDs
        paragraph_ids = ['para1', 'para2']
        result = self.db_service.get_paragraphs_for_diacritics('book123', paragraph_ids)
        
        # Verify the SQL query includes IN clause and uses correct column names
        mock_cursor.execute.assert_called_once()
        sql_query = mock_cursor.execute.call_args[0][0]
        params = mock_cursor.execute.call_args[0][1]
        
        # Check that the query uses camelCase column names
        self.assertIn('"bookId"', sql_query)
        self.assertIn('"pageId"', sql_query)
        self.assertIn('"orderIndex"', sql_query)
        
        # Check IN clause for paragraph IDs
        self.assertIn('id IN (%s,%s)', sql_query)
        
        # Check parameters
        self.assertEqual(params, ['book123'] + paragraph_ids)


if __name__ == '__main__':
    unittest.main()
