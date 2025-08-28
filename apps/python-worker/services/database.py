"""
Database service for PostgreSQL operations in the diacritics worker.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from logging_config import get_logger

logger = get_logger(__name__)


class DatabaseService:
    """Database service for PostgreSQL operations"""
    
    def __init__(self, connection_string: str):
        # Strip quotes from connection string if present
        self.connection_string = connection_string.strip('"\'')
        # Remove schema parameter as psycopg2 doesn't support it in the connection string
        if '?schema=' in self.connection_string:
            self.connection_string = self.connection_string.split('?schema=')[0]
        self.connection = None
    
    async def connect(self):
        """Connect to PostgreSQL database"""
        try:
            logger.info("Attempting to connect to PostgreSQL database...")
            self.connection = psycopg2.connect(
                self.connection_string,
                cursor_factory=RealDictCursor,
                connect_timeout=10  # 10 second timeout
            )
            self.connection.autocommit = True
            logger.info("Connected to PostgreSQL database successfully")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def disconnect(self):
        """Disconnect from database"""
        if self.connection:
            self.connection.close()
            logger.info("Disconnected from database")
    
    def get_paragraphs_for_diacritics(self, book_id: str, paragraph_ids: Optional[List[str]] = None) -> List[Dict]:
        """Get paragraphs that need diacritics processing"""
        if not self.connection:
            raise RuntimeError("Database not connected")
            
        cursor = self.connection.cursor()
        
        try:
            where_conditions = ['"bookId" = %s']
            params = [book_id]
            
            if paragraph_ids:
                placeholders = ','.join(['%s'] * len(paragraph_ids))
                where_conditions.append(f"id IN ({placeholders})")
                params.extend(paragraph_ids)
            
            # Get all paragraphs - we'll process them regardless of current state
            # This allows reprocessing if needed
            query = f"""
                SELECT id, content, "orderIndex", "pageId"
                FROM paragraphs
                WHERE {' AND '.join(where_conditions)}
                ORDER BY "pageId" ASC, "orderIndex" ASC
            """
            
            cursor.execute(query, params)
            result = cursor.fetchall()
            
            logger.debug(f"Retrieved {len(result)} paragraphs for book {book_id}")
            return result
            
        finally:
            cursor.close()
    
    def update_paragraph_content(self, paragraph_id: str, new_content: str):
        """Update paragraph content with diacritics version"""
        if not self.connection:
            raise RuntimeError("Database not connected")
            
        cursor = self.connection.cursor()
        
        try:
            cursor.execute("""
                UPDATE paragraphs 
                SET content = %s, updated_at = %s
                WHERE id = %s
            """, (new_content, datetime.utcnow(), paragraph_id))
            
            logger.debug(f"Updated paragraph {paragraph_id} with diacritics content")
            
        finally:
            cursor.close()
    
    def get_paragraph_by_id(self, paragraph_id: str) -> Optional[Dict]:
        """Get a single paragraph by ID"""
        if not self.connection:
            raise RuntimeError("Database not connected")
            
        cursor = self.connection.cursor()
        
        try:
            cursor.execute("""
                SELECT id, content, "orderIndex", "pageId", "bookId"
                FROM paragraphs
                WHERE id = %s
            """, (paragraph_id,))
            
            result = cursor.fetchone()
            return result
            
        finally:
            cursor.close()
    
    def get_book_paragraph_count(self, book_id: str) -> int:
        """Get total paragraph count for a book"""
        if not self.connection:
            raise RuntimeError("Database not connected")
            
        cursor = self.connection.cursor()
        
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM paragraphs
                WHERE "bookId" = %s
            """, (book_id,))
            
            result = cursor.fetchone()
            return result['count'] if result else 0
            
        finally:
            cursor.close()
