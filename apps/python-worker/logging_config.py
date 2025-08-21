"""
Logging configuration for the Python worker.
"""

import os
import sys
import structlog
from typing import Any, Dict


def configure_logging() -> None:
    """Configure structured logging for the Python worker."""
    
    # Get log level from environment
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    
    # Configure structlog
    structlog.configure(
        processors=[
            # Add timestamp
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="ISO"),
            
            # Add correlation ID if available
            _add_correlation_id,
            
            # Format for console output
            structlog.dev.ConsoleRenderer() if _is_development() else structlog.processors.JSONRenderer(),
        ],
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


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a configured logger instance."""
    return structlog.get_logger(name)


# Configure logging when module is imported
configure_logging()
