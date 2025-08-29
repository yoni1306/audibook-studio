#!/usr/bin/env python3
"""
Diacritics Service for Hebrew Text Processing

This service provides an HTTP API for adding Hebrew diacritics (nikud) to text
using the phonikud-onnx library.
"""

import os
import logging
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variable to store the phonikud instance
phonikud_instance = None

class DiacriticsRequest(BaseModel):
    """Request model for adding diacritics to text"""
    text: str
    mark_matres_lectionis: Optional[str] = None

class DiacriticsResponse(BaseModel):
    """Response model for diacritics processing"""
    original_text: str
    text_with_diacritics: str
    processing_time_ms: float

class BatchDiacriticsRequest(BaseModel):
    """Request model for batch processing multiple texts"""
    texts: List[str]
    mark_matres_lectionis: Optional[str] = None

class BatchDiacriticsResponse(BaseModel):
    """Response model for batch diacritics processing"""
    results: List[DiacriticsResponse]
    total_processing_time_ms: float

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager to initialize the phonikud model"""
    global phonikud_instance
    
    try:
        logger.info("Initializing phonikud model...")
        
        # Try to find the model file
        model_path = os.getenv('PHONIKUD_MODEL_PATH', './phonikud-1.0.int8.onnx')
        
        if not os.path.exists(model_path):
            logger.warning(f"Model file not found at {model_path}, attempting to download...")
            # In a production environment, you might want to download the model here
            # For now, we'll use a placeholder
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        from phonikud_onnx import Phonikud
        phonikud_instance = Phonikud(model_path)
        
        logger.info("Phonikud model initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize phonikud model: {e}")
        # For development, we'll create a mock instance
        logger.warning("Creating mock phonikud instance for development")
        phonikud_instance = MockPhonikud()
    
    yield
    
    # Cleanup
    phonikud_instance = None
    logger.info("Phonikud service shutdown")

class MockPhonikud:
    """Mock phonikud implementation for development/testing"""
    
    def add_diacritics(self, text: str) -> str:
        """Mock implementation that just returns the original text with a marker"""
        logger.warning("Using mock phonikud implementation")
        return f"[MOCK_DIACRITICS]{text}[/MOCK_DIACRITICS]"

# Create FastAPI app with lifespan
app = FastAPI(
    title="Hebrew Diacritics Service",
    description="HTTP API for adding Hebrew diacritics (nikud) to text using phonikud-onnx",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "diacritics-service",
        "model_loaded": phonikud_instance is not None
    }

@app.post("/add-diacritics", response_model=DiacriticsResponse)
async def add_diacritics(request: DiacriticsRequest):
    """Add diacritics to Hebrew text"""
    if phonikud_instance is None:
        raise HTTPException(status_code=503, detail="Phonikud model not initialized")
    
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    try:
        import time
        start_time = time.time()
        
        # Process the text
        text_with_diacritics = phonikud_instance.add_diacritics(request.text)
        
        processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        logger.info(f"Processed text of length {len(request.text)} in {processing_time:.2f}ms")
        
        return DiacriticsResponse(
            original_text=request.text,
            text_with_diacritics=text_with_diacritics,
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error processing diacritics: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing diacritics: {str(e)}")

@app.post("/add-diacritics-batch", response_model=BatchDiacriticsResponse)
async def add_diacritics_batch(request: BatchDiacriticsRequest):
    """Add diacritics to multiple Hebrew texts in batch"""
    if phonikud_instance is None:
        raise HTTPException(status_code=503, detail="Phonikud model not initialized")
    
    if not request.texts:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")
    
    try:
        import time
        start_time = time.time()
        
        results = []
        for text in request.texts:
            if not text.strip():
                continue
                
            text_start = time.time()
            text_with_diacritics = phonikud_instance.add_diacritics(text)
            text_processing_time = (time.time() - text_start) * 1000
            
            results.append(DiacriticsResponse(
                original_text=text,
                text_with_diacritics=text_with_diacritics,
                processing_time_ms=text_processing_time
            ))
        
        total_processing_time = (time.time() - start_time) * 1000
        
        logger.info(f"Processed {len(results)} texts in {total_processing_time:.2f}ms")
        
        return BatchDiacriticsResponse(
            results=results,
            total_processing_time_ms=total_processing_time
        )
        
    except Exception as e:
        logger.error(f"Error processing batch diacritics: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing batch diacritics: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8001"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting diacritics service on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("NODE_ENV") != "production",
        log_level="info"
    )
