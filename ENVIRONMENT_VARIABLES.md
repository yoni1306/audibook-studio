# Environment Variables Configuration

This document outlines the environment variables needed for the Audibook Studio project across different deployment environments.

## Overview

The project uses different environment variable configurations for:
- **Local Development**: Using `.env.local` with Docker services
- **Production**: Using Railway deployment with environment-specific URLs

## Local Development (.env.local)

For local development, copy the existing `.env.local` file which includes:

### API Service Configuration
```bash
NODE_ENV=development
PORT=3000
```

### Web Service Configuration
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
# No INTERNAL_API_URL needed for local dev - web app connects directly to localhost API
```

### Additional Services
- Database: Local PostgreSQL in Docker
- Redis: Local Redis in Docker  
- S3: MinIO for local file storage
- Azure Speech: Production service (shared)
- Logging: Local console logging

## Production - Railway Configuration

### API Service Environment Variables
Set these in your Railway API service:

```bash
NODE_ENV=production
PORT=3000

# Database - Railway PostgreSQL addon
DATABASE_URL="postgresql://username:password@host:port/database?schema=public"

# Redis - Railway Redis addon  
REDIS_HOST=redis-host
REDIS_PORT=6379

# AWS S3 - Production bucket
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your-production-access-key
AWS_SECRET_ACCESS_KEY=your-production-secret-key
S3_BUCKET_NAME=audibook-production-storage

# Azure Cognitive Services
AZURE_SPEECH_KEY=your-production-speech-key
AZURE_SPEECH_VOICE=he-IL-AvriNeural
AZURE_SPEECH_REGION=westeurope

# Logging
LOKI_HOST=https://your-loki-instance.com
LOKI_BASIC_AUTH=username:password
LOG_LEVEL=info

# Service identification
API_SERVICE_NAME=audibook-api-prod
WORKER_SERVICE_NAME=audibook-worker-prod
WEB_SERVICE_NAME=audibook-web-prod
```

### Web Service Environment Variables
Set these in your Railway Web service:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api-production.up.railway.app  # Your API's public URL
INTERNAL_API_URL=http://api:3000  # Internal Railway service communication
```

## Key Concepts

### API URL Configuration

#### Local Development
- **Web → API**: Direct connection to `http://localhost:3000`
- **Simple setup**: Both services run on localhost

#### Production (Railway)
- **Browser → API**: Uses `NEXT_PUBLIC_API_URL` (public Railway URL)
- **Server → API**: Uses `INTERNAL_API_URL` (internal Railway network)
- **Internal communication**: Railway services can communicate using service names

### Environment-Aware API Client

The typed API client automatically resolves the correct base URL:

```typescript
// In development
const apiClient = createApiClient('http://localhost:3000');

// In production (browser)
const apiClient = createApiClient('https://api-production.up.railway.app');

// In production (server-side)
const apiClient = createApiClient('http://api:3000');
```

### Railway Internal Networking

In Railway, services can communicate internally using service names:
- `http://api:3000` - Connects to the API service internally
- `http://worker:3001` - Connects to the worker service internally
- This avoids external network calls and improves performance

## Setup Instructions

### Local Development
1. Copy `.env.local.example` to `.env.local` (if not already present)
2. Update any service-specific values as needed
3. Run `docker-compose up -d` to start supporting services
4. Run `pnpm run dev:all` to start all application services

### Production Deployment
1. Copy values from `.env.production.example`
2. Set environment variables in Railway dashboard for each service
3. Update URLs to match your actual Railway deployment URLs
4. Deploy services in order: API → Worker → Web

## Security Notes

- Never commit actual production credentials to version control
- Use Railway's environment variable management for production secrets
- Keep `.env.local` in `.gitignore` to prevent accidental commits
- Rotate API keys and credentials regularly

## Troubleshooting

### Common Issues

1. **API client can't connect**: Check `NEXT_PUBLIC_API_URL` matches your API service URL
2. **Internal server errors**: Verify `INTERNAL_API_URL` uses correct Railway service name
3. **CORS errors**: Ensure API service allows requests from web service domain
4. **Environment not detected**: Check `NODE_ENV` is set correctly in all services

### Debugging

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

This will provide detailed information about API client initialization and URL resolution.
