"""
SQLAlchemy models for the Python worker.
Matches the Prisma schema from the main application.
"""

from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Book(Base):
    __tablename__ = 'books'
    
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    author = Column(String)
    status = Column(String, nullable=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    pages = relationship("Page", back_populates="book", cascade="all, delete-orphan")
    paragraphs = relationship("Paragraph", back_populates="book")


class Page(Base):
    __tablename__ = 'pages'
    
    id = Column(String, primary_key=True)
    bookId = Column(String, ForeignKey('books.id', ondelete='CASCADE'), nullable=False)
    pageNumber = Column(Integer, nullable=False)
    title = Column(String)
    content = Column(Text)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    book = relationship("Book", back_populates="pages")
    paragraphs = relationship("Paragraph", back_populates="page", cascade="all, delete-orphan")
    original_paragraphs = relationship("OriginalParagraph", back_populates="page", cascade="all, delete-orphan")


class OriginalParagraph(Base):
    __tablename__ = 'original_paragraphs'
    
    id = Column(String, primary_key=True)
    pageId = Column(String, ForeignKey('pages.id', ondelete='CASCADE'), nullable=False)
    content = Column(Text, nullable=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    page = relationship("Page", back_populates="original_paragraphs")
    paragraphs = relationship("Paragraph", back_populates="original_paragraph")


class Paragraph(Base):
    __tablename__ = 'paragraphs'
    
    id = Column(String, primary_key=True)
    pageId = Column(String, ForeignKey('pages.id', ondelete='CASCADE'), nullable=False)
    bookId = Column(String, ForeignKey('books.id'), nullable=False)
    orderIndex = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    originalParagraphId = Column(String, ForeignKey('original_paragraphs.id', ondelete='SET NULL'))
    audioStatus = Column(String, default='PENDING')
    audioS3Key = Column(String)
    completed = Column(Boolean, default=False)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    page = relationship("Page", back_populates="paragraphs")
    book = relationship("Book", back_populates="paragraphs")
    original_paragraph = relationship("OriginalParagraph", back_populates="paragraphs")
