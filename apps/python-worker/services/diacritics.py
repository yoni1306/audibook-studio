"""
Diacritics service for Hebrew text processing using phonikud.
"""

import os
import logging
import re
from typing import List, Optional, Tuple
from logging_config import get_logger

logger = get_logger(__name__)


class DiacriticsService:
    """Service for Hebrew diacritics processing using phonikud"""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or os.getenv('PHONIKUD_MODEL_PATH', './phonikud-1.0.int8.onnx')
        self.phonikud = None
        self._is_initialized = False
    
    async def initialize(self):
        """Initialize the phonikud model"""
        if self._is_initialized:
            return
            
        try:
            # Try to initialize phonikud-onnx with model path
            if os.path.exists(self.model_path):
                from phonikud_onnx import Phonikud
                self.phonikud = Phonikud(self.model_path)
                logger.info(f"Phonikud model initialized successfully: {self.model_path}")
            else:
                # Model file doesn't exist, try to use phonikud-onnx with a default/bundled model
                logger.info(f"Model file not found at {self.model_path}, trying default phonikud model...")
                from phonikud_onnx import Phonikud
                # Try common model locations or let package handle it
                possible_paths = [
                    "/app/models/phonikud-1.0.onnx",
                    "./models/phonikud-1.0.onnx",
                    "phonikud-1.0.onnx"
                ]
                model_loaded = False
                for path in possible_paths:
                    if os.path.exists(path):
                        self.phonikud = Phonikud(path)
                        logger.info(f"Phonikud model loaded from: {path}")
                        model_loaded = True
                        break
                
                if not model_loaded:
                    logger.warning("No phonikud model found, using mock implementation")
                    self.phonikud = MockPhonikud()
        except Exception as e:
            logger.warning(f"Failed to initialize phonikud model, using mock: {e}")
            # Fallback to mock implementation
            self.phonikud = MockPhonikud()
        
        self._is_initialized = True
    
    def is_initialized(self) -> bool:
        """Check if the service is initialized"""
        return self._is_initialized and self.phonikud is not None
    
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
                return self.phonikud.add_diacritics(text)
            else:
                # Multiple chunks, process each and rejoin
                processed_chunks = []
                for i, chunk in enumerate(chunks):
                    logger.debug(f"Processing chunk {i+1}/{len(chunks)} (length: {len(chunk)})")
                    processed_chunk = self.phonikud.add_diacritics(chunk)
                    processed_chunks.append(processed_chunk)
                
                # Rejoin chunks with space
                return " ".join(processed_chunks)
                
        except Exception as e:
            logger.error(f"Error processing text for diacritics: {e}")
            return text  # Return original text on error
    
    def add_diacritics_batch(self, texts: List[str], mark_matres_lectionis=None) -> List[str]:
        """Add diacritics to a batch of texts with chunking support"""
        if not self.is_initialized():
            raise RuntimeError("Diacritics service not initialized")
        
        results = []
        for i, text in enumerate(texts):
            try:
                # Use the chunking-enabled add_diacritics method
                result = self.add_diacritics(text, None)
                results.append(result)
                logger.debug(f"Processed text {i+1}/{len(texts)} (length: {len(text)})")
            except Exception as e:
                logger.error(f"Error processing text {i+1} for diacritics: {e}")
                results.append(text)  # Return original text on error
        
        return results
    
    def get_model_info(self) -> dict:
        """Get information about the loaded model"""
        return {
            'model_path': self.model_path,
            'is_initialized': self._is_initialized,
            'is_mock': isinstance(self.phonikud, MockPhonikud),
            'model_exists': os.path.exists(self.model_path) if self.model_path else False
        }


class MockPhonikud:
    """Mock phonikud implementation for development/testing"""
    
    def add_diacritics(self, text: str) -> str:
        """Mock implementation that adds a marker to the text"""
        logger.debug("Using mock phonikud implementation")
        return f"[MOCK_DIACRITICS]{text}[/MOCK_DIACRITICS]"
    
    def get_metadata(self) -> dict:
        """Mock metadata method"""
        return {
            'model_type': 'mock',
            'version': '1.0.0-mock'
        }
