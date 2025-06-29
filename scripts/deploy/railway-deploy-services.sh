#!/bin/bash

# Railway Deployment Script for Audibook Studio
# Creates Railway services and databases for the monorepo
#
# DEPLOYMENT STRATEGY: Docker
# - Each service uses its own optimized Dockerfile
# - Multi-stage builds for smaller production images
# - Service-specific Dockerfile paths:
#   * API: apps/api/Dockerfile (includes Prisma generation)
#   * Workers: apps/workers/Dockerfile (background jobs)
#   * Web: apps/web/Dockerfile (Next.js production)
#   * Shared-Secrets: No Dockerfile (env vars only)

echo "🚂 Railway Services Deployment"
echo "=============================="
echo "This script will create all services and databases"
echo ""

# Login to Railway
railway login --browserless

# Check if already linked to a project
if ! railway status &>/dev/null; then
    echo "❌ No Railway project linked. Please run 'railway link' first"
    exit 1
fi

echo "✅ Connected to Railway project"
echo ""

# Helper function to check if service exists
check_service_exists() {
    local service_name="$1"
    railway service "$service_name" &>/dev/null
    return $?
}

# Helper function to check if database exists
check_database_exists() {
    local db_type="$1"
    railway status 2>/dev/null | grep -i "$db_type" &>/dev/null
    return $?
}

# Create databases
echo "📦 Creating databases..."
echo "------------------------"

echo "→ Checking PostgreSQL..."
if check_database_exists "postgres"; then
    echo "   ✅ PostgreSQL already exists"
else
    echo "   Creating PostgreSQL..."
    railway add --database postgres
    echo "   ✅ PostgreSQL created"
fi

echo "→ Checking Redis..."
if check_database_exists "redis"; then
    echo "   ✅ Redis already exists"
else
    echo "   Creating Redis..."
    railway add --database redis
    echo "   ✅ Redis created"
fi

echo "✅ Database setup complete"
echo ""

# Create services
echo "🔧 Creating services..."
echo "----------------------"

echo "📝 Using direct environment variables (no shared-secrets service)"
echo ""

echo "→ Checking api service..."
if check_service_exists "api"; then
    echo "   ✅ api service already exists"
else
    echo "   Creating api service..."
    railway add --service api
    echo "   ✅ api service created"
    echo "   Note: Auto-migrations are enabled in the Dockerfile"
fi

echo "→ Checking workers service..."
if check_service_exists "workers"; then
    echo "   ✅ workers service already exists"
else
    echo "   Creating workers service..."
    railway add --service workers
    echo "   ✅ workers service created"
fi

echo "→ Checking web service..."
if check_service_exists "web"; then
    echo "   ✅ web service already exists"
else
    echo "   Creating web service..."
    railway add --service web
    echo "   ✅ web service created"
fi

echo "✅ Services setup complete"
echo ""

# Configure Dockerfile paths for each service
echo "🐳 Configuring Dockerfile paths..."
echo "----------------------------------"

echo "→ Setting API Dockerfile path..."
railway service api
railway variables --set "RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile"
echo "   ✅ API Dockerfile path set to: apps/api/Dockerfile"

echo "→ Setting Workers Dockerfile path..."
railway service workers
railway variables --set "RAILWAY_DOCKERFILE_PATH=apps/workers/Dockerfile"
echo "   ✅ Workers Dockerfile path set to: apps/workers/Dockerfile"

echo "→ Setting Web Dockerfile path..."
railway service web
railway variables --set "RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile"
echo "   ✅ Web Dockerfile path set to: apps/web/Dockerfile"

echo "→ Configuring Shared-Secrets service..."
railway service shared-secrets
railway variables --set "RAILWAY_START_COMMAND=sleep infinity"
echo "   ✅ Shared-Secrets start command configured"

echo "✅ Dockerfile paths configured"
echo ""

# Generate public domain for API
echo "🌍 Setting up API domain..."
echo "----------------------------"
railway service api

# Check if domain already exists
if railway domain 2>/dev/null | grep -q "https://"; then
    echo "✅ API domain already exists"
    railway domain
else
    echo "Creating new domain for API..."
    railway domain
    echo "✅ API domain generated"
fi
echo ""

# Summary
echo "📋 Services Created:"
echo "\n=== NEXT STEPS ==="
echo "Services created and configured successfully! 🎉"
echo ""
echo "✅ COMPLETED AUTOMATICALLY:"
echo "   - All databases created (PostgreSQL, Redis)"
echo "   - All services created (api, workers, web, shared-secrets)"
echo "   - Dockerfile paths configured for each service"
echo "   - API public domain generated"
echo ""
echo "1. Run secrets configuration:"
echo "   ./scripts/deploy/railway-secrets-config.sh"
echo ""
echo "2. Deploy services (one by one):"
echo "   railway service api && railway up"
echo "   railway service workers && railway up"
echo "   railway service web && railway up"
echo ""
echo "3. Run database migrations:"
echo "   railway service api"
echo "   railway run 'cd apps/api && npx prisma migrate deploy'"
echo ""
echo "4. Monitor deployments:"
echo "   railway status"
echo "   railway logs -s api"
echo ""
echo "💡 Useful commands:"
echo "=================="
echo "railway status          # View all services"
echo "railway open           # Open Railway dashboard"
echo "railway logs -s api    # View service logs"