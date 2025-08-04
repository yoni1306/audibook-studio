#!/bin/bash

# Migration Rollback Helper Script
# Usage: ./scripts/rollback-migration.sh <rollback_script_name>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if rollback script name is provided
if [ $# -eq 0 ]; then
    print_error "No rollback script specified"
    echo "Usage: $0 <rollback_script_name>"
    echo ""
    echo "Available rollback scripts:"
    ls -la apps/api/prisma/rollback-migrations/
    exit 1
fi

ROLLBACK_SCRIPT="$1"
ROLLBACK_PATH="apps/api/prisma/rollback-migrations/${ROLLBACK_SCRIPT}"

# Check if rollback script exists
if [ ! -f "$ROLLBACK_PATH" ]; then
    print_error "Rollback script not found: $ROLLBACK_PATH"
    echo ""
    echo "Available rollback scripts:"
    ls -la apps/api/prisma/rollback-migrations/
    exit 1
fi

# Load environment variables
if [ -f ".env.local" ]; then
    export $(grep -v '^#' .env.local | xargs)
else
    print_error ".env.local file not found"
    exit 1
fi

# Extract database name from DATABASE_URL
DB_NAME=$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')

print_warning "⚠️  MIGRATION ROLLBACK WARNING ⚠️"
echo ""
echo "You are about to rollback migration: $ROLLBACK_SCRIPT"
echo "Database: $DB_NAME"
echo "Rollback script: $ROLLBACK_PATH"
echo ""
print_warning "This operation may result in data loss!"
echo ""

# Confirmation prompt
read -p "Do you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_info "Rollback cancelled"
    exit 0
fi

# Create backup
BACKUP_FILE="backup_before_rollback_$(date +%Y%m%d_%H%M%S).sql"
print_info "Creating database backup: $BACKUP_FILE"

if command -v pg_dump &> /dev/null; then
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
    print_success "Database backup created: $BACKUP_FILE"
else
    print_error "pg_dump not found. Please create a manual backup before proceeding."
    read -p "Continue without backup? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_info "Rollback cancelled"
        exit 0
    fi
fi

# Apply rollback
print_info "Applying rollback script: $ROLLBACK_SCRIPT"

if psql "$DATABASE_URL" -f "$ROLLBACK_PATH"; then
    print_success "Rollback script applied successfully"
else
    print_error "Rollback script failed"
    if [ -f "$BACKUP_FILE" ]; then
        print_info "You can restore from backup: psql $DATABASE_URL < $BACKUP_FILE"
    fi
    exit 1
fi

# Regenerate Prisma client
print_info "Regenerating Prisma client..."
cd apps/api && npx prisma generate
print_success "Prisma client regenerated"

print_success "🎉 Migration rollback completed successfully!"
echo ""
print_warning "Next steps:"
echo "1. Update your Prisma schema file to match the rolled-back database"
echo "2. Test your application thoroughly"
echo "3. Deploy the updated schema to other environments"
echo ""
if [ -f "$BACKUP_FILE" ]; then
    print_info "Backup file saved as: $BACKUP_FILE"
fi
