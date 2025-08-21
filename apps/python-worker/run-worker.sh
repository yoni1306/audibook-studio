#!/bin/bash

# Python Worker Startup Script
# This script handles environment setup and starts the worker

set -e

echo "🐍 Starting Python Diacritics Worker..."

# Check if we're in a virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  Warning: Not in a virtual environment"
fi

# Load environment variables
if [ -f .env ]; then
    echo "📄 Loading environment from .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  No .env file found, using system environment"
fi

# Check required environment variables
required_vars=("REDIS_URL" "DATABASE_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set"
        exit 1
    fi
done

# Run health check first
echo "🏥 Running health check..."
python health_check.py
if [ $? -ne 0 ]; then
    echo "❌ Health check failed, exiting"
    exit 1
fi

echo "✅ Health check passed"

# Start the worker
echo "🚀 Starting worker..."
exec python worker.py
