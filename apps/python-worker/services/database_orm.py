"""
SQLAlchemy-based database service for PostgreSQL operations in the diacritics worker.
Replaces raw SQL queries with ORM to eliminate column name issues.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, and_, text
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
    
    def get_paragraphs_for_diacritics(self, book_id: str, paragraph_ids: Optional[List[str]] = None) -> List[Dict]:
        """Get paragraphs that need diacritics processing using SQLAlchemy ORM"""
        with self.get_session() as session:
            try:
                # Build query using SQLAlchemy ORM
                query = session.query(Paragraph).filter(Paragraph.bookId == book_id)
                
                if paragraph_ids:
                    query = query.filter(Paragraph.id.in_(paragraph_ids))
                
                # Order by pageId and orderIndex
                query = query.order_by(Paragraph.pageId.asc(), Paragraph.orderIndex.asc())
                
                # Execute query and convert to dict format
                paragraphs = query.all()
                result = []
                for p in paragraphs:
                    result.append({
                        'id': p.id,
                        'content': p.content,
                        'orderIndex': p.orderIndex,
                        'pageId': p.pageId
                    })
                
                logger.debug(f"Retrieved {len(result)} paragraphs for book {book_id}")
                return result
                
            except SQLAlchemyError as e:
                logger.error(f"Database error in get_paragraphs_for_diacritics: {e}")
                raise
    
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
