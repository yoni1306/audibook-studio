"""
Logging configuration for the Python worker with Loki integration.
"""

import os
import sys
import logging
import structlog
import requests
import json
from typing import Any, Dict
from logging_loki import LokiHandler


def configure_logging() -> None:
    """Configure structured logging for the Python worker with Loki integration."""
    
    # Get configuration from environment
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    loki_url = os.getenv('LOKI_URL', 'http://localhost:3100/loki/api/v1/push')
    service_name = os.getenv('SERVICE_NAME', 'python-worker')
    environment = os.getenv('ENVIRONMENT', 'development')
    
    # Configure standard logging first
    logging.basicConfig(level=getattr(logging, log_level), format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Only add Loki handler if LOKI_URL is properly configured and not disabled
    loki_enabled = os.getenv('LOKI_ENABLED', 'true').lower() == 'true'
    
    if loki_enabled and loki_url and loki_url != 'http://localhost:3100/loki/api/v1/push':
        try:
            # Create Loki handler with error handling
            loki_handler = LokiHandler(
                url=loki_url,
                tags={
                    "service": service_name,
                    "environment": environment,
                    "worker_type": "python",
                    "component": "diacritics-processor"
                },
                version="1"
            )
            
            # Add Loki handler only to root logger
            root_logger = logging.getLogger()
            root_logger.addHandler(loki_handler)
            
        except Exception as e:
            print(f"Warning: Failed to configure Loki logging: {e}")
            print("Continuing with console logging only")
    
    # Configure structlog with both console and Loki output
    processors = [
        # Add timestamp
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="ISO"),
        
        # Add correlation ID if available
        _add_correlation_id,
        
        # Add service context
        _add_service_context,
    ]
    
    # Add appropriate renderer based on environment
    if _is_development():
        processors.append(structlog.dev.ConsoleRenderer())
    else:
        processors.append(structlog.processors.JSONRenderer())
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        context_class=dict,
        cache_logger_on_first_use=True,
    )


def _is_development() -> bool:
    """Check if we're in development mode."""
    return os.getenv('NODE_ENV', '').lower() == 'development' or os.getenv('LOG_LEVEL', '').lower() == 'debug'


def _add_correlation_id(logger: Any, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add correlation ID to log entries if available."""
    # This could be enhanced to get correlation ID from context
    # For now, we'll add it if it's in the event dict
    return event_dict


def _add_service_context(logger: Any, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add service context to log entries."""
    event_dict.update({
        "service": os.getenv('SERVICE_NAME', 'python-worker'),
        "environment": os.getenv('ENVIRONMENT', 'development'),
        "worker_type": "python",
        "component": "diacritics-processor"
    })
    return event_dict


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a configured logger instance."""
    return structlog.get_logger(name)


# Configure logging when module is imported
configure_logging()
