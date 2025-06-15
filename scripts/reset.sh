#!/bin/bash

echo "🗑️  Resetting Redis queue..."
docker exec audibook-studio-redis-1 redis-cli FLUSHALL

echo "🗑️  Resetting PostgreSQL database..."
pnpm exec prisma db push --schema=apps/api/prisma/schema.prisma --force-reset --accept-data-loss

echo "✅ Reset complete!"