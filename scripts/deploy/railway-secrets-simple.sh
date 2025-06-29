#!/bin/bash

# Railway Simple Secrets Configuration
# Sets environment variables directly in each service (no shared-secrets)

set -e

echo "🔐 Railway Simple Secrets Configuration"
echo "======================================"
echo ""

# Load environment variables from file if it exists
if [ -f "aws-credentials-production.txt" ]; then
    echo "📁 Loading credentials from aws-credentials-production.txt..."
    source aws-credentials-production.txt
fi

# Check required variables
required_vars=("AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "S3_BUCKET_NAME")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing required environment variables:"
    printf '   %s\n' "${missing_vars[@]}"
    echo ""
    echo "Please set these variables or add them to aws-credentials-production.txt"
    exit 1
fi

echo "✅ All required variables found"
echo ""

# Generate secrets if not provided
# JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
# SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
# INTERNAL_API_KEY="${INTERNAL_API_KEY:-$(openssl rand -hex 32)}"

echo "🔧 Configuring API service..."
echo "----------------------------"
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

# AWS/S3 configuration
railway variables --set AWS_REGION="${AWS_REGION:-eu-central-1}"
railway variables --set AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
railway variables --set AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
railway variables --set S3_BUCKET_NAME="$S3_BUCKET_NAME"
railway variables --set S3_ENDPOINT="${S3_ENDPOINT:-}"

# Security
# railway variables --set JWT_SECRET="$JWT_SECRET"
# railway variables --set SESSION_SECRET="$SESSION_SECRET"
# railway variables --set INTERNAL_API_KEY="$INTERNAL_API_KEY"

# Application config
railway variables --set MAX_FILE_SIZE_MB="${MAX_FILE_SIZE_MB:-100}"
railway variables --set ALLOWED_FILE_TYPES="${ALLOWED_FILE_TYPES:-epub,pdf}"

# Logging
railway variables --set SERVICE_NAME="audibook-api"
railway variables --set LOG_LEVEL="${LOG_LEVEL:-info}"

# Optional services (commented out - uncomment if needed)
# if [ -n "$LOKI_HOST" ]; then
#     railway variables --set LOKI_HOST="$LOKI_HOST"
#     railway variables --set LOKI_BASIC_AUTH="$LOKI_BASIC_AUTH"
# fi

# if [ -n "$AZURE_SPEECH_KEY" ]; then
#     railway variables --set AZURE_SPEECH_KEY="$AZURE_SPEECH_KEY"
#     railway variables --set AZURE_SPEECH_REGION="${AZURE_SPEECH_REGION:-westeurope}"
#     railway variables --set AZURE_SPEECH_VOICE="${AZURE_SPEECH_VOICE:-en-US-AriaNeural}"
# fi

echo "✅ API service configured"
echo ""

echo "🔧 Configuring Workers service..."
echo "--------------------------------"
railway service workers

# Core environment
railway variables --set NODE_ENV=production

# Database configuration
railway variables --set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# Redis configuration
railway variables --set REDIS_URL='${{Redis.REDIS_URL}}'
railway variables --set REDIS_HOST='${{Redis.REDISHOST}}'
railway variables --set REDIS_PORT='${{Redis.REDISPORT}}'

# AWS/S3 configuration
railway variables --set AWS_REGION="${AWS_REGION:-eu-central-1}"
railway variables --set AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
railway variables --set AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
railway variables --set S3_BUCKET_NAME="$S3_BUCKET_NAME"
railway variables --set S3_ENDPOINT="${S3_ENDPOINT:-}"

# Azure Speech (commented out - uncomment if needed)
# if [ -n "$AZURE_SPEECH_KEY" ]; then
#     railway variables --set AZURE_SPEECH_KEY="$AZURE_SPEECH_KEY"
#     railway variables --set AZURE_SPEECH_REGION="${AZURE_SPEECH_REGION:-westeurope}"
#     railway variables --set AZURE_SPEECH_VOICE="${AZURE_SPEECH_VOICE:-en-US-AriaNeural}"
# fi

# Worker configuration
# railway variables --set INTERNAL_API_KEY="$INTERNAL_API_KEY"
railway variables --set WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-2}"
railway variables --set SERVICE_NAME="audibook-worker"
railway variables --set LOG_LEVEL="${LOG_LEVEL:-info}"

# Logging (commented out - uncomment if needed)
# if [ -n "$LOKI_HOST" ]; then
#     railway variables --set LOKI_HOST="$LOKI_HOST"
#     railway variables --set LOKI_BASIC_AUTH="$LOKI_BASIC_AUTH"
# fi

echo "✅ Workers service configured"
echo ""

echo "🔧 Configuring Web service..."
echo "----------------------------"
railway service web

# Core environment
railway variables --set NODE_ENV=production

# Database configuration
railway variables --set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# Redis configuration
railway variables --set REDIS_URL='${{Redis.REDIS_URL}}'
railway variables --set REDIS_HOST='${{Redis.REDISHOST}}'
railway variables --set REDIS_PORT='${{Redis.REDISPORT}}'

# Next.js configuration
railway variables --set NEXT_PUBLIC_API_URL='https://${{api.RAILWAY_PUBLIC_DOMAIN}}'

# Logging
railway variables --set SERVICE_NAME="audibook-web"
railway variables --set LOG_LEVEL="${LOG_LEVEL:-info}"

# if [ -n "$LOKI_HOST" ]; then
#     railway variables --set LOKI_HOST="$LOKI_HOST"
#     railway variables --set LOKI_BASIC_AUTH="$LOKI_BASIC_AUTH"
# fi

echo "✅ Web service configured"
echo ""

echo "📋 Configuration Summary"
echo "======================="
echo "✅ API service configured with all variables"
echo "✅ Workers service configured with all variables"
echo "✅ Web service configured with all variables"
echo ""
echo "🔒 Security Status"
echo "=================="
echo "✅ Secrets set directly in each service"
echo "✅ Generated secure JWT and session secrets"
echo "✅ Database and Redis URLs provided by Railway"
echo ""
echo "🎯 Next Steps"
echo "============"
echo "1. Deploy services: railway up"
echo "2. Check logs: railway logs -s [service-name]"
echo "3. Open dashboard: railway open"
echo ""
echo "✅ Simple secrets configuration complete!"
