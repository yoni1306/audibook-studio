#!/bin/sh
set -e

echo "Starting API service..."

# Always run migrations on startup
echo "Running database migrations..."
pnpm prisma migrate deploy --schema=/app/apps/api/prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo "✓ Migrations completed successfully"
else
    echo "✗ Migration failed!"
    exit 1
fi

# Start the application
echo "Starting Node.js application..."
cd /app
exec node dist/apps/api/main.js
