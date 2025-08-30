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
        processors.append(_custom_console_renderer)
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
    return os.getenv('NODE_ENV', '').lower() == 'development' or os.getenv('LOG_LEVEL', '').lower() == 'debug' or os.getenv('ENVIRONMENT', '').lower() == 'development'


def _add_correlation_id(logger: Any, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add correlation ID to log entries if available."""
    # This could be enhanced to get correlation ID from context
    # For now, we'll add it if it's in the event dict
    return event_dict


def _custom_console_renderer(logger: Any, method_name: str, event_dict: Dict[str, Any]) -> str:
    """Custom console renderer for better readability."""
    timestamp = event_dict.get('timestamp', '').split('T')[1].split('.')[0] if 'T' in event_dict.get('timestamp', '') else ''
    level = event_dict.get('level', '').upper()
    logger_name = event_dict.get('logger', '').split('.')[-1]  # Just the last part
    event = event_dict.get('event', '')
    
    # Extract key context for tracking from both top level and extra
    extra = event_dict.get('extra', {})
    correlation_id = event_dict.get('correlation_id', '') or extra.get('correlation_id', '')
    book_id = event_dict.get('book_id', '') or extra.get('book_id', '')
    batch_num = event_dict.get('batch_num', '') or extra.get('batch_num', '')
    job_type = event_dict.get('job_type', '') or extra.get('job_type', '')
    
    # Build context string with shortened IDs
    context_parts = []
    if correlation_id:
        short_corr = correlation_id.split('-')[-1][:8] if '-' in correlation_id else correlation_id[-8:]
        context_parts.append(f"corr:{short_corr}")
    if book_id:
        short_book = book_id.split('-')[-1][:8] if '-' in book_id else book_id[-8:]
        context_parts.append(f"book:{short_book}")
    if batch_num:
        context_parts.append(f"batch:{batch_num}")
    if job_type:
        context_parts.append(f"type:{job_type.replace('add-', '').replace('-diacritics', '')}")
    
    context = f"[{' | '.join(context_parts)}]" if context_parts else ""
    
    # Color coding for different log levels
    level_colors = {
        'INFO': '\033[32m',   # Green
        'WARN': '\033[33m',   # Yellow  
        'ERROR': '\033[31m',  # Red
        'DEBUG': '\033[36m'   # Cyan
    }
    reset_color = '\033[0m'
    level_color = level_colors.get(level, '')
    
    # Format the main log line with better spacing
    main_line = f"{level_color}{timestamp} {level:5}{reset_color} {logger_name:15} {context:25} {event}"
    
    # Add key metrics on same line for batch completion
    if 'batch completed' in event.lower() and extra:
        metrics = []
        if 'progress_percentage' in extra:
            metrics.append(f"{extra['progress_percentage']}%")
        if 'batch_processed' in extra:
            metrics.append(f"{extra['batch_processed']} processed")
        if 'diacritics_duration_seconds' in extra:
            metrics.append(f"{extra['diacritics_duration_seconds']}s")
        if metrics:
            main_line += f" ({', '.join(metrics)})"
    
    return main_line


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
