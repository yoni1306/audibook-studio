# Multi-stage build for Python Worker service
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY apps/python-worker/requirements.txt ./

# Install Python dependencies (cached layer)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY apps/python-worker/ ./

# Create directory for model files
RUN mkdir -p /app/models

# Production stage
FROM python:3.11-slim AS production

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r worker && useradd -r -g worker worker

# Set working directory
WORKDIR /app

# Copy installed packages from base stage
COPY --from=base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=base /usr/local/bin /usr/local/bin

# Copy application code
COPY --from=base /app ./

# Set proper ownership
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PHONIKUD_MODEL_PATH=/app/models/phonikud-1.0.int8.onnx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python health_check.py || exit 1

# Run the worker
CMD ["python", "worker.py"]
