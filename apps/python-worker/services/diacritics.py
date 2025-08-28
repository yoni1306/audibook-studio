"""
Diacritics service for Hebrew text processing using phonikud.
"""

import os
from typing import List

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
    
    def add_diacritics(self, text: str) -> str:
        """Add diacritics to a single text"""
        if not self.is_initialized():
            raise RuntimeError("Diacritics service not initialized")
        
        try:
            return self.phonikud.add_diacritics(text)
        except Exception as e:
            logger.error(f"Error processing text for diacritics: {e}")
            return text  # Return original text on error
    
    def add_diacritics_batch(self, texts: List[str]) -> List[str]:
        """Add diacritics to a batch of texts"""
        if not self.is_initialized():
            raise RuntimeError("Diacritics service not initialized")
        
        results = []
        for i, text in enumerate(texts):
            try:
                result = self.phonikud.add_diacritics(text)
                results.append(result)
                logger.debug(f"Processed text {i+1}/{len(texts)}")
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
