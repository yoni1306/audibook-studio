"""
SQLAlchemy-based database service for PostgreSQL operations in the diacritics worker.
Replaces raw SQL queries with ORM to eliminate column name issues.
"""
import os
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from models import Base, Book, Page, Paragraph, OriginalParagraph
from logging_config import get_logger

logger = get_logger(__name__)


class DatabaseORMService:
    """SQLAlchemy-based database service for PostgreSQL operations"""
    
    def __init__(self, connection_string: str):
        # Strip quotes from connection string if present
        self.connection_string = connection_string.strip('"\'')
        # Remove schema parameter as SQLAlchemy handles it differently
        if '?schema=' in self.connection_string:
            self.connection_string = self.connection_string.split('?schema=')[0]
        
        self.engine = None
        self.SessionLocal = None
        
    async def connect(self):
        """Connect to PostgreSQL database using SQLAlchemy"""
        try:
            logger.info("Attempting to connect to PostgreSQL database with SQLAlchemy...")
            self.engine = create_engine(
                self.connection_string,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False  # Set to True for SQL debugging
            )
            
            # Create session factory
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            
            # Test connection
            with self.SessionLocal() as session:
                session.execute(text("SELECT 1"))
                
            logger.info("Connected to PostgreSQL database successfully with SQLAlchemy")
        except Exception as e:
            logger.error(f"Failed to connect to database with SQLAlchemy: {e}")
            raise
    
    def disconnect(self):
        """Disconnect from database"""
        if self.engine:
            self.engine.dispose()
            logger.info("Disconnected from database")
    
    def get_session(self) -> Session:
        """Get a new database session"""
        if not self.SessionLocal:
            raise RuntimeError("Database not connected")
        return self.SessionLocal()
    
    def get_paragraphs_for_diacritics(self, book_id: str) -> List[Dict]:
        """Get all paragraphs for a book that need diacritics processing, ordered by page then paragraph"""
        try:
            query = text("""
                SELECT p.id, p.content, p."orderIndex", p."pageId", pg."orderIndex" as page_order
                FROM "Paragraph" p
                JOIN "Page" pg ON p."pageId" = pg.id
                WHERE pg."bookId" = :book_id
                AND p.content IS NOT NULL
                AND p.content != ''
                ORDER BY pg."orderIndex" ASC, p."orderIndex" ASC
            """)
            
            result = self.engine.execute(query, {"book_id": book_id})
            paragraphs = []
            for row in result:
                paragraphs.append({
                    'id': row.id,
                    'content': row.content,
                    'orderIndex': row.orderIndex,
                    'pageId': row.pageId,
                    'page_order': row.page_order
                })
            
            return paragraphs
        except Exception as e:
            logger.error(f"Error fetching paragraphs for diacritics: {e}")
            return []
    
    def update_paragraph_content(self, paragraph_id: str, new_content: str):
        """Update paragraph content with diacritics version using SQLAlchemy ORM"""
        with self.get_session() as session:
            try:
                # Find and update paragraph
                paragraph = session.query(Paragraph).filter(Paragraph.id == paragraph_id).first()
                
                if paragraph:
                    paragraph.content = new_content
                    session.commit()
                    logger.debug(f"Updated paragraph {paragraph_id} with diacritics content")
                else:
                    logger.debug(f"Paragraph {paragraph_id} not found for update (may have been deleted)")
                    
            except SQLAlchemyError as e:
                logger.error(f"Database error in update_paragraph_content: {e}")
                session.rollback()
                raise
    
    def get_paragraph_by_id(self, paragraph_id: str) -> Optional[Dict]:
        """Get a single paragraph by ID using SQLAlchemy ORM"""
        with self.get_session() as session:
            try:
                paragraph = session.query(Paragraph).filter(Paragraph.id == paragraph_id).first()
                
                if paragraph:
                    return {
                        'id': paragraph.id,
                        'content': paragraph.content,
                        'orderIndex': paragraph.orderIndex,
                        'pageId': paragraph.pageId,
                        'bookId': paragraph.bookId
                    }
                return None
                
            except SQLAlchemyError as e:
                logger.error(f"Database error in get_paragraph_by_id: {e}")
                raise
    
    def get_book_paragraph_count(self, book_id: str) -> int:
        """Get total paragraph count for a book using SQLAlchemy ORM"""
        with self.get_session() as session:
            try:
                count = session.query(Paragraph).filter(Paragraph.bookId == book_id).count()
                return count
                
            except SQLAlchemyError as e:
                logger.error(f"Database error in get_book_paragraph_count: {e}")
                raise
    
    def get_book_by_id(self, book_id: str) -> Optional[Book]:
        """Get book by ID including processing metadata"""
        with self.get_session() as session:
            try:
                book = session.query(Book).filter(Book.id == book_id).first()
                return book
                
            except SQLAlchemyError as e:
                logger.error(f"Database error in get_book_by_id: {e}")
                raise
