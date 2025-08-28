"""
Unit tests for SQLAlchemy migration of the database service.
Tests that the ORM-based service works correctly and eliminates SQL column issues.
"""

import unittest
import asyncio
from unittest.mock import Mock, patch, MagicMock
from services.database_orm import DatabaseORMService
from models import Paragraph


class TestSQLAlchemyMigration(unittest.IsolatedAsyncioTestCase):
    """Test SQLAlchemy ORM database service"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.db_service = DatabaseORMService("postgresql://test:test@localhost:5432/test")
        
    @patch('services.database_orm.create_engine')
    @patch('services.database_orm.sessionmaker')
    async def test_connection_setup(self, mock_sessionmaker, mock_create_engine):
        """Test that SQLAlchemy connection is set up correctly"""
        mock_engine = Mock()
        mock_create_engine.return_value = mock_engine
        mock_session_class = Mock()
        mock_sessionmaker.return_value = mock_session_class
        
        # Mock session context manager
        mock_session = Mock()
        mock_session_class.return_value.__enter__ = Mock(return_value=mock_session)
        mock_session_class.return_value.__exit__ = Mock(return_value=None)
        
        # Test connection
        await self.db_service.connect()
        
        # Verify engine creation
        mock_create_engine.assert_called_once()
        self.assertEqual(self.db_service.engine, mock_engine)
        
    @patch('services.database_orm.sessionmaker')
    def test_get_paragraphs_for_diacritics_orm(self, mock_sessionmaker):
        """Test that get_paragraphs_for_diacritics uses ORM correctly"""
        # Mock session and query
        mock_session = Mock()
        mock_query = Mock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        
        # Mock paragraph results
        mock_paragraph = Mock()
        mock_paragraph.id = 'para1'
        mock_paragraph.content = 'test content'
        mock_paragraph.orderIndex = 1
        mock_paragraph.pageId = 'page1'
        mock_query.all.return_value = [mock_paragraph]
        
        # Mock session context manager
        mock_session_class = Mock()
        mock_session_class.return_value.__enter__ = Mock(return_value=mock_session)
        mock_session_class.return_value.__exit__ = Mock(return_value=None)
        mock_sessionmaker.return_value = mock_session_class
        self.db_service.SessionLocal = mock_session_class
        
        # Call the method
        result = self.db_service.get_paragraphs_for_diacritics('book123')
        
        # Verify ORM query was built correctly
        mock_session.query.assert_called_once_with(Paragraph)
        mock_query.filter.assert_called()
        mock_query.order_by.assert_called()
        
        # Verify result format
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['id'], 'para1')
        self.assertEqual(result[0]['content'], 'test content')
        self.assertEqual(result[0]['orderIndex'], 1)
        self.assertEqual(result[0]['pageId'], 'page1')
        
    @patch('services.database_orm.sessionmaker')
    def test_update_paragraph_content_orm(self, mock_sessionmaker):
        """Test that update_paragraph_content uses ORM correctly"""
        # Mock session and paragraph
        mock_session = Mock()
        mock_paragraph = Mock()
        mock_paragraph.content = 'old content'
        mock_session.query.return_value.filter.return_value.first.return_value = mock_paragraph
        
        # Mock session context manager
        mock_session_class = Mock()
        mock_session_class.return_value.__enter__ = Mock(return_value=mock_session)
        mock_session_class.return_value.__exit__ = Mock(return_value=None)
        mock_sessionmaker.return_value = mock_session_class
        self.db_service.SessionLocal = mock_session_class
        
        # Call the method
        self.db_service.update_paragraph_content('para1', 'new content with diacritics')
        
        # Verify ORM operations
        mock_session.query.assert_called_once_with(Paragraph)
        mock_session.commit.assert_called_once()
        self.assertEqual(mock_paragraph.content, 'new content with diacritics')
        
    @patch('services.database_orm.sessionmaker')
    def test_get_book_paragraph_count_orm(self, mock_sessionmaker):
        """Test that get_book_paragraph_count uses ORM correctly"""
        # Mock session and count
        mock_session = Mock()
        mock_session.query.return_value.filter.return_value.count.return_value = 5
        
        # Mock session context manager
        mock_session_class = Mock()
        mock_session_class.return_value.__enter__ = Mock(return_value=mock_session)
        mock_session_class.return_value.__exit__ = Mock(return_value=None)
        mock_sessionmaker.return_value = mock_session_class
        self.db_service.SessionLocal = mock_session_class
        
        # Call the method
        result = self.db_service.get_book_paragraph_count('book123')
        
        # Verify ORM operations
        mock_session.query.assert_called_once_with(Paragraph)
        self.assertEqual(result, 5)


if __name__ == '__main__':
    unittest.main()
