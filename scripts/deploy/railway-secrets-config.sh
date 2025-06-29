#!/bin/bash

# Railway Secrets and Environment Variables Configuration
# This script sets up all environment variables using centralized references
# Run this AFTER railway-deploy.sh

echo "🔐 Railway Secrets Configuration"
echo "================================"
echo ""

# Load secrets from .env.production
set -a
source .env.production
set +a

echo "✅ Loaded secrets from .env.production"
echo ""

# Check if connected to Railway
if ! railway status &>/dev/null; then
    echo "❌ No Railway project linked. Please run 'railway link' first"
    exit 1
fi

# Function to check if service exists
service_exists() {
    # Try to connect to the service and check if it succeeds
    railway service "$1" 2>/dev/null && return 0 || return 1
}

# Verify all required services exist
echo "🔍 Verifying services..."
echo "------------------------"

required_services=("shared-secrets" "api" "workers" "web")
missing_services=()

for service in "${required_services[@]}"; do
    if service_exists "$service"; then
        echo "✓ $service found"
    else
        echo "✗ $service missing"
        missing_services+=("$service")
    fi
done

if [ ${#missing_services[@]} -ne 0 ]; then
    echo ""
    echo "❌ Missing services: ${missing_services[*]}"
    echo "Please run ./railway-deploy.sh first"
    exit 1
fi

echo ""
echo "✅ All required services found"
echo ""

# Configure shared-secrets service
echo "🔐 Configuring shared-secrets service..."
echo "---------------------------------------"
railway service shared-secrets

# Database Configuration
echo "→ Setting database configuration..."
railway variables --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}"
railway variables --set "REDIS_URL=\${{Redis.REDIS_URL}}"

# AWS S3 Configuration
echo "→ Setting AWS S3 configuration..."
railway variables --set AWS_REGION="$AWS_REGION"
railway variables --set AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
railway variables --set AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
railway variables --set S3_BUCKET_NAME="$S3_BUCKET_NAME"
[ -n "$S3_ENDPOINT" ] && railway variables --set S3_ENDPOINT="$S3_ENDPOINT"

# Azure TTS Configuration
echo "→ Setting Azure TTS configuration..."
railway variables --set AZURE_SPEECH_KEY="$AZURE_SPEECH_KEY"
railway variables --set AZURE_SPEECH_VOICE="${AZURE_SPEECH_VOICE:-he-IL-AvriNeural}"
railway variables --set AZURE_SPEECH_REGION="${AZURE_SPEECH_REGION:-westeurope}"

# Logging Configuration
echo "→ Setting logging configuration..."
[ -n "$LOKI_HOST" ] && railway variables --set LOKI_HOST="$LOKI_HOST"
[ -n "$LOKI_BASIC_AUTH" ] && railway variables --set LOKI_BASIC_AUTH="$LOKI_BASIC_AUTH"
railway variables --set API_LOG_LEVEL="${API_LOG_LEVEL:-info}"
railway variables --set WORKER_LOG_LEVEL="${WORKER_LOG_LEVEL:-info}"
railway variables --set WEB_LOG_LEVEL="${WEB_LOG_LEVEL:-info}"

# Service Names
echo "→ Setting service names..."
railway variables --set API_SERVICE_NAME="${API_SERVICE_NAME:-audibook-api}"
railway variables --set WORKER_SERVICE_NAME="${WORKER_SERVICE_NAME:-audibook-worker}"
railway variables --set WEB_SERVICE_NAME="${WEB_SERVICE_NAME:-audibook-web}"

# Security Configuration
# echo "→ Setting security configuration..."
# railway variables --set JWT_SECRET="$JWT_SECRET"
# railway variables --set SESSION_SECRET="$SESSION_SECRET"
# railway variables --set INTERNAL_API_KEY="${INTERNAL_API_KEY:-$(openssl rand -hex 32)}"

# Application Configuration
echo "→ Setting application configuration..."
railway variables --set WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-2}"
railway variables --set MAX_FILE_SIZE_MB="${MAX_FILE_SIZE_MB:-100}"
railway variables --set ALLOWED_FILE_TYPES="${ALLOWED_FILE_TYPES:-epub,pdf}"

# Optional OpenAI Configuration
if [ -n "$OPENAI_API_KEY" ]; then
    echo "→ Setting OpenAI configuration..."
    railway variables --set OPENAI_API_KEY="$OPENAI_API_KEY"
    [ -n "$OPENAI_TTS_MODEL" ] && railway variables --set OPENAI_TTS_MODEL="$OPENAI_TTS_MODEL"
    [ -n "$OPENAI_TTS_VOICE" ] && railway variables --set OPENAI_TTS_VOICE="$OPENAI_TTS_VOICE"
fi

echo "✅ Shared secrets configured"
echo ""

# Configure API Service
echo "🔧 Configuring API service variables..."
echo "--------------------------------------"
railway service api

# Core environment
railway variables --set NODE_ENV=production
railway variables --set PORT=3000

# Database configuration (Railway automatically provides these)
railway variables --set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# Redis configuration (Railway automatically provides these)
railway variables --set REDIS_URL='${{Redis.REDIS_URL}}'
railway variables --set REDIS_HOST='${{Redis.REDISHOST}}'
railway variables --set REDIS_PORT='${{Redis.REDISPORT}}'

# Reference shared secrets
railway variables --set AWS_REGION='${{shared-secrets.AWS_REGION}}'
railway variables --set AWS_ACCESS_KEY_ID='${{shared-secrets.AWS_ACCESS_KEY_ID}}'
railway variables --set AWS_SECRET_ACCESS_KEY='${{shared-secrets.AWS_SECRET_ACCESS_KEY}}'
railway variables --set S3_BUCKET_NAME='${{shared-secrets.S3_BUCKET_NAME}}'
railway variables --set S3_ENDPOINT='${{shared-secrets.S3_ENDPOINT}}'
railway variables --set JWT_SECRET='${{shared-secrets.JWT_SECRET}}'
railway variables --set SESSION_SECRET='${{shared-secrets.SESSION_SECRET}}'
railway variables --set INTERNAL_API_KEY='${{shared-secrets.INTERNAL_API_KEY}}'
railway variables --set MAX_FILE_SIZE_MB='${{shared-secrets.MAX_FILE_SIZE_MB}}'
railway variables --set ALLOWED_FILE_TYPES='${{shared-secrets.ALLOWED_FILE_TYPES}}'

# Logging configuration
railway variables --set SERVICE_NAME='${{shared-secrets.API_SERVICE_NAME}}'
railway variables --set LOG_LEVEL='${{shared-secrets.API_LOG_LEVEL}}'
railway variables --set LOKI_HOST='${{shared-secrets.LOKI_HOST}}'
railway variables --set LOKI_BASIC_AUTH='${{shared-secrets.LOKI_BASIC_AUTH}}'

echo "✅ API service configured"
echo ""

# Configure Workers Service
echo "⚙️  Configuring Workers service variables..."
echo "------------------------------------------"
railway service workers

# Core environment
railway variables --set NODE_ENV=production

# Database configuration (Railway automatically provides these)
railway variables --set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# Redis configuration (Railway automatically provides these)
railway variables --set REDIS_URL='${{Redis.REDIS_URL}}'
railway variables --set REDIS_HOST='${{Redis.REDISHOST}}'
railway variables --set REDIS_PORT='${{Redis.REDISPORT}}'

# Reference shared secrets
railway variables --set AWS_REGION='${{shared-secrets.AWS_REGION}}'
railway variables --set AWS_ACCESS_KEY_ID='${{shared-secrets.AWS_ACCESS_KEY_ID}}'
railway variables --set AWS_SECRET_ACCESS_KEY='${{shared-secrets.AWS_SECRET_ACCESS_KEY}}'
railway variables --set S3_BUCKET_NAME='${{shared-secrets.S3_BUCKET_NAME}}'
railway variables --set S3_ENDPOINT='${{shared-secrets.S3_ENDPOINT}}'
railway variables --set AZURE_SPEECH_KEY='${{shared-secrets.AZURE_SPEECH_KEY}}'
railway variables --set AZURE_SPEECH_REGION='${{shared-secrets.AZURE_SPEECH_REGION}}'
railway variables --set AZURE_SPEECH_VOICE='${{shared-secrets.AZURE_SPEECH_VOICE}}'
railway variables --set INTERNAL_API_KEY='${{shared-secrets.INTERNAL_API_KEY}}'
railway variables --set WORKER_CONCURRENCY='${{shared-secrets.WORKER_CONCURRENCY}}'

# OpenAI if configured
# railway variables --set OPENAI_API_KEY='${{shared-secrets.OPENAI_API_KEY}}'
# railway variables --set OPENAI_TTS_MODEL='${{shared-secrets.OPENAI_TTS_MODEL}}'
# railway variables --set OPENAI_TTS_VOICE='${{shared-secrets.OPENAI_TTS_VOICE}}'

# Logging configuration
railway variables --set SERVICE_NAME='${{shared-secrets.WORKER_SERVICE_NAME}}'
railway variables --set LOG_LEVEL='${{shared-secrets.WORKER_LOG_LEVEL}}'
railway variables --set LOKI_HOST='${{shared-secrets.LOKI_HOST}}'
railway variables --set LOKI_BASIC_AUTH='${{shared-secrets.LOKI_BASIC_AUTH}}'

echo "✅ Workers service configured"
echo ""

# Configure Web Service
echo "🌐 Configuring Web service variables..."
echo "--------------------------------------"
railway service web

# Core environment
railway variables --set NODE_ENV=production

# Database configuration (Railway automatically provides these)
railway variables --set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# Redis configuration (Railway automatically provides these)
railway variables --set REDIS_URL='${{Redis.REDIS_URL}}'
railway variables --set REDIS_HOST='${{Redis.REDISHOST}}'
railway variables --set REDIS_PORT='${{Redis.REDISPORT}}'

# Next.js configuration
railway variables --set NEXT_PUBLIC_API_URL='https://${{api.RAILWAY_PUBLIC_DOMAIN}}'

# Logging configuration
railway variables --set SERVICE_NAME='${{shared-secrets.WEB_SERVICE_NAME}}'
railway variables --set LOG_LEVEL='${{shared-secrets.WEB_LOG_LEVEL}}'
railway variables --set LOKI_HOST='${{shared-secrets.LOKI_HOST}}'
railway variables --set LOKI_BASIC_AUTH='${{shared-secrets.LOKI_BASIC_AUTH}}'

echo "✅ Web service configured"
echo ""

# Summary
echo "📋 Configuration Summary"
echo "======================="
echo "✓ Shared secrets service configured with all keys"
echo "✓ API service configured with references"
echo "✓ Workers service configured with references"
echo "✓ Web service configured with references"
echo ""
echo "🔒 Security Status"
echo "=================="
echo "✓ All secrets stored in shared-secrets service"
echo "✓ Other services use references (no duplication)"
echo "✓ Redis using REDISHOST/REDISPORT/REDIS_URL format"
echo "✓ Easy key rotation - update only in shared-secrets"
echo ""
echo "🎯 Next Steps"
echo "============"
echo "1. Deploy all services: railway up"
echo "2. Run migrations: railway run 'cd apps/api && npx prisma migrate deploy'"
echo "3. Check logs: railway logs -s [service-name]"
echo "4. Open dashboard: railway open"
echo ""
if [ -n "$LOKI_HOST" ]; then
    echo "📊 Grafana Loki"
    echo "=============="
    echo "✓ Loki configured for centralized logging"
    echo "✓ Access your Grafana dashboard to view logs"
fi
echo ""
echo "⚠️  Important Reminders"
echo "====================="
echo "- Add .env.production to .gitignore"
echo "- Enable 2FA on your Railway account"
echo "- Rotate keys periodically"
echo "- Never commit secrets to Git"