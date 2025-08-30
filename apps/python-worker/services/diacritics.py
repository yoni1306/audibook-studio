"""
Diacritics service for Hebrew text processing using phonikud-onnx and dicta-onnx.
"""

import os
import logging
import re
from typing import List, Optional, Tuple
from logging_config import get_logger

logger = get_logger(__name__)


class DiacriticsService:
    """Service for Hebrew diacritics processing using phonikud and dicta"""
    
    def __init__(self, phonikud_model_path: str = None, dicta_model_path: str = None):
        self.phonikud_model_path = phonikud_model_path or os.getenv('PHONIKUD_MODEL_PATH', '/app/models/phonikud-1.0.onnx')
        self.dicta_model_path = dicta_model_path or os.getenv('DICTA_MODEL_PATH', '/app/models/dicta-1.0.int8.onnx')
        self.phonikud_instance = None
        self.dicta_instance = None
        self._is_initialized = False
    
    async def initialize(self):
        """Initialize both phonikud and dicta models"""
        if self._is_initialized:
            return
            
        # Initialize phonikud model
        try:
            if os.path.exists(self.phonikud_model_path):
                from phonikud_onnx import Phonikud
                self.phonikud_instance = Phonikud(self.phonikud_model_path)
                logger.info(f"Phonikud model initialized successfully: {self.phonikud_model_path}")
            else:
                logger.warning(f"Phonikud model not found at {self.phonikud_model_path}")
                self.phonikud_instance = MockPhonikud()
        except Exception as e:
            logger.warning(f"Failed to initialize phonikud model, using mock: {e}")
            self.phonikud_instance = MockPhonikud()
        
        # Initialize dicta model
        try:
            if os.path.exists(self.dicta_model_path):
                from dicta_onnx import Dicta
                self.dicta_instance = Dicta(self.dicta_model_path)
                logger.info(f"Dicta model initialized successfully: {self.dicta_model_path}")
            else:
                logger.warning(f"Dicta model not found at {self.dicta_model_path}")
                self.dicta_instance = MockDicta()
        except Exception as e:
            logger.warning(f"Failed to initialize dicta model, using mock: {e}")
            self.dicta_instance = MockDicta()
        
        self._is_initialized = True
    
    def is_initialized(self) -> bool:
        """Check if the service is initialized"""
        return self._is_initialized and self.phonikud_instance is not None
    
    def _split_text_into_chunks(self, text: str, max_chars: int = 2046) -> List[str]:
        """
        Split text into chunks prioritizing full sentences over character limit.
        
        Args:
            text: Text to split
            max_chars: Maximum characters per chunk (default 2046)
            
        Returns:
            List of text chunks containing full sentences
        """
        if len(text) <= max_chars:
            return [text]
        
        # Hebrew sentence endings: period, question mark, exclamation mark
        # Also include common Hebrew punctuation
        sentence_endings = r'[.!?׃։]'
        
        # Split text into sentences
        sentences = re.split(f'({sentence_endings})', text)
        
        # Rejoin sentence endings with their sentences
        processed_sentences = []
        i = 0
        while i < len(sentences):
            sentence = sentences[i].strip()
            if sentence:
                # Check if next item is a punctuation mark
                if i + 1 < len(sentences) and re.match(sentence_endings, sentences[i + 1]):
                    sentence += sentences[i + 1]
                    i += 2
                else:
                    i += 1
                processed_sentences.append(sentence)
            else:
                i += 1
        
        # Group sentences into chunks
        chunks = []
        current_chunk = ""
        
        for sentence in processed_sentences:
            # If adding this sentence would exceed the limit
            if current_chunk and len(current_chunk) + len(sentence) + 1 > max_chars:
                # Save current chunk and start a new one
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                # Add sentence to current chunk
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
        
        # Add the last chunk if it exists
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        # Handle edge case where a single sentence is longer than max_chars
        final_chunks = []
        for chunk in chunks:
            if len(chunk) <= max_chars:
                final_chunks.append(chunk)
            else:
                # Split long sentences by words as fallback
                words = chunk.split()
                current_word_chunk = ""
                
                for word in words:
                    if current_word_chunk and len(current_word_chunk) + len(word) + 1 > max_chars:
                        final_chunks.append(current_word_chunk.strip())
                        current_word_chunk = word
                    else:
                        if current_word_chunk:
                            current_word_chunk += " " + word
                        else:
                            current_word_chunk = word
                
                if current_word_chunk.strip():
                    final_chunks.append(current_word_chunk.strip())
        
        return final_chunks if final_chunks else [text]
    
    
    def add_diacritics(self, text: str, mark_matres_lectionis=None) -> str:
        """Add diacritics to a single text with chunking support"""
        if not self.is_initialized():
            raise RuntimeError("Diacritics service not initialized")
        
        try:
            # Split text into chunks if it's too long
            chunks = self._split_text_into_chunks(text)
            
            if len(chunks) == 1:
                # Single chunk, process directly
                return self.phonikud_instance.add_diacritics(text, mark_matres_lectionis=mark_matres_lectionis)
            else:
                # Multiple chunks, process each and rejoin
                processed_chunks = []
                for i, chunk in enumerate(chunks):
                    logger.debug(f"Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})")
                    processed_chunk = self.phonikud_instance.add_diacritics(chunk, mark_matres_lectionis=mark_matres_lectionis)
                    processed_chunks.append(processed_chunk)
                
                # Rejoin chunks with space
                return " ".join(processed_chunks)
                
        except Exception as e:
            logger.error(f"Error processing text for diacritics: {e}")
            return text  # Return original text on error
    
    def add_advanced_diacritics_batch(self, texts: List[str], mark_matres_lectionis=None) -> List[str]:
        """Add advanced diacritics to a batch of texts using phonikud model with chunking support"""
        logger.info(f"🔧 Starting advanced diacritics processing", extra={
            "batch_size": len(texts),
            "mark_matres_lectionis": mark_matres_lectionis,
            "model": "phonikud"
        })
        
        if not self.is_initialized():
            raise RuntimeError("Diacritics service not initialized")
        
        results = []
        for text in texts:
            try:
                result = self.add_diacritics(text, mark_matres_lectionis=mark_matres_lectionis)
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing text in batch: {e}")
                results.append(text)  # Return original text on error
        
        logger.info(f"🔧 Completed advanced diacritics processing", extra={
            "batch_size": len(texts),
            "results_count": len(results),
            "model": "phonikud"
        })
        
        return results
    
    def add_simple_diacritics(self, text: str) -> str:
        """Add simple diacritics using dicta model"""
        if not self.is_initialized():
            raise RuntimeError("Diacritics service not initialized")
        
        try:
            # Split text into chunks if it's too long
            chunks = self._split_text_into_chunks(text)
            
            if len(chunks) == 1:
                # Single chunk, process directly
                return self.dicta_instance.add_diacritics(text)
            else:
                # Multiple chunks, process each and rejoin
                processed_chunks = []
                for i, chunk in enumerate(chunks):
                    logger.debug(f"Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})")
                    processed_chunk = self.dicta_instance.add_diacritics(chunk)
                    processed_chunks.append(processed_chunk)
                
                # Rejoin chunks with space
                return " ".join(processed_chunks)
                
        except Exception as e:
            logger.error(f"Error processing text for simple diacritics: {e}")
            return text  # Return original text on error
    
    def add_simple_diacritics_batch(self, texts: List[str]) -> List[str]:
        """Add simple diacritics to a batch of texts using dicta model"""
        logger.info(f"🔧 Starting simple diacritics processing", extra={
            "batch_size": len(texts),
            "model": "dicta"
        })
        
        if not self.is_initialized():
            raise RuntimeError("Diacritics service not initialized")
        
        results = []
        for text in texts:
            try:
                result = self.add_simple_diacritics(text)
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing text in batch: {e}")
                results.append(text)  # Return original text on error
        
        logger.info(f"🔧 Completed simple diacritics processing", extra={
            "batch_size": len(texts),
            "results_count": len(results),
            "model": "dicta"
        })
        
        return results

    def get_model_info(self) -> dict:
        """Get information about the loaded models"""
        return {
            'phonikud_model_path': self.phonikud_model_path,
            'dicta_model_path': self.dicta_model_path,
            'is_initialized': self._is_initialized,
            'phonikud_is_mock': isinstance(self.phonikud_instance, MockPhonikud),
            'dicta_is_mock': isinstance(self.dicta_instance, MockDicta),
            'phonikud_model_exists': os.path.exists(self.phonikud_model_path) if self.phonikud_model_path else False,
            'dicta_model_exists': os.path.exists(self.dicta_model_path) if self.dicta_model_path else False
        }


class MockPhonikud:
    """Mock phonikud implementation for development/testing"""
    
    def add_diacritics(self, text: str) -> str:
        """Mock implementation that adds a marker to the text"""
        logger.debug("Using mock phonikud implementation")
        return f"[MOCK_DIACRITICS]{text}[/MOCK_DIACRITICS]"


class MockDicta:
    """Mock dicta implementation for development/testing"""
    
    def add_diacritics(self, text: str) -> str:
        """Mock implementation that adds a marker to the text"""
        logger.debug("Using mock dicta implementation")
        return f"[MOCK_SIMPLE_DIACRITICS]{text}[/MOCK_SIMPLE_DIACRITICS]"
    
    def get_metadata(self) -> dict:
        """Mock metadata method"""
        return {
            'model_type': 'mock',
            'version': '1.0.0-mock'
        }
