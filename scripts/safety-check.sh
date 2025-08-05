#!/bin/bash

# Safety check script to prevent dangerous operations in production
# This script ensures reset commands only run in development environment

set -e

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

print_error() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Check if we're in Railway environment
if [ "$RAILWAY_ENVIRONMENT" = "production" ] || [ "$NODE_ENV" = "production" ]; then
    print_error "PRODUCTION ENVIRONMENT DETECTED!"
    print_error "Reset commands are not allowed in production."
    print_error "Environment: NODE_ENV=$NODE_ENV, RAILWAY_ENVIRONMENT=$RAILWAY_ENVIRONMENT"
    exit 1
fi

# Check if DATABASE_URL contains production indicators
if [ -n "$DATABASE_URL" ]; then
    if [[ "$DATABASE_URL" == *"railway.app"* ]] || [[ "$DATABASE_URL" == *"prod"* ]]; then
        print_error "PRODUCTION DATABASE DETECTED!"
        print_error "DATABASE_URL appears to point to a production database."
        print_error "Reset commands are not allowed on production databases."
        exit 1
    fi
fi

# Check if .env.local exists (development indicator)
if [ ! -f ".env.local" ] && [ ! -f "../../.env.local" ]; then
    print_warning "No .env.local file found."
    print_warning "This might indicate you're not in a development environment."
    
    # Ask for confirmation
    echo -n "Are you sure you want to continue? (type 'yes' to confirm): "
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        print_error "Operation cancelled by user."
        exit 1
    fi
fi

# Check if Docker is running (required for local development)
if ! docker ps >/dev/null 2>&1; then
    print_error "Docker is not running or not accessible."
    print_error "Reset commands require Docker for local development."
    exit 1
fi

# Check if the specific Redis container exists
if ! docker ps --format "table {{.Names}}" | grep -q "audibook-studio-redis-1"; then
    print_warning "Local Redis container 'audibook-studio-redis-1' not found."
    print_warning "This might indicate you're not in the expected development environment."
fi

print_success "Safety checks passed - proceeding with reset operation in development environment."
