# 🚀 Audibook Studio - Build & Run Guide

This guide provides easy-to-follow instructions for building and running Audibook Studio both locally and on Railway.

## 📋 Prerequisites

### Local Development
- **Node.js** 18+ and **pnpm** installed
- **Docker Desktop** running
- **Git** for version control

### Railway Deployment
- **Railway CLI** installed: `npm install -g @railway/cli`
- **Railway account** and project linked
- **Environment variables** configured

---

## 🏠 Local Development

### Quick Start (Recommended)

```bash
# 1. One-time setup (installs dependencies, starts Docker services, sets up database)
pnpm run setup:local

# 2. Start the full development stack
pnpm run dev:full
```

That's it! Your application will be running at:
- **Web App**: http://localhost:4200
- **API**: http://localhost:3000
- **API Docs**: http://localhost:3000/api

### Manual Setup (Alternative)

If you prefer to run steps manually:

```bash
# Install dependencies
pnpm install

# Start Docker services (PostgreSQL, Redis, MinIO)
docker-compose up -d db redis minio

# Setup database
pnpm prisma:generate
pnpm prisma:push

# Start development servers
pnpm run dev:full
```

### Individual Services

```bash
# API only
pnpm run dev:api

# Web frontend only  
pnpm run dev:web

# Background workers only
pnpm run dev:workers

# API + Web + Workers (all services)
pnpm run dev

# Full stack with API client auto-generation
pnpm run dev:full
```

### Useful Local Commands

```bash
# Database management
pnpm prisma:studio          # Open Prisma Studio
pnpm run reset:db           # Reset database
pnpm run reset:queue        # Clear Redis queue

# API client generation
pnpm run generate:api-types # Generate TypeScript types from OpenAPI
pnpm run generate:api-client # Build API client library

# Monitoring
pnpm run logs:all           # View all Docker logs
docker-compose logs -f api  # View specific service logs

# Testing
pnpm test                   # Run all tests
pnpm test:api              # API tests only
pnpm test:web              # Web tests only
```

---

## ☁️ Railway Deployment

### Quick Deploy (Recommended)

```bash
# Complete deployment (creates services, configures secrets, deploys)
pnpm run deploy:railway
```

This single command will:
1. Create all Railway services and databases
2. Configure environment variables and secrets
3. Deploy all services with proper build configurations
4. Set up domains and networking

### Manual Deployment (Step by Step)

```bash
# 1. Create services and databases
pnpm run deploy:services

# 2. Configure environment variables
pnpm run deploy:secrets

# 3. Deploy individual services
railway service api && railway up
railway service workers && railway up  
railway service web && railway up
```

### Railway Management Commands

```bash
# Check deployment status
railway status

# View logs
railway logs --service api
railway logs --service workers
railway logs --service web

# Open Railway dashboard
railway open

# Connect to production database
railway connect postgres

# Run database migrations
railway service api
railway run 'cd apps/api && npx prisma migrate deploy'
```

---

## 🔧 Build Commands

### Local Builds

```bash
# Build all services
pnpm build

# Build individual services
pnpm build:api
pnpm build:web
pnpm build:workers

# Build with API client generation
pnpm run generate:api-client && pnpm build
```

### Production Builds

Railway automatically builds using the Dockerfiles:
- **API**: `apps/api/Dockerfile` (includes Prisma generation and auto-migrations)
- **Workers**: `apps/workers/Dockerfile` (optimized for background jobs)
- **Web**: `apps/web/Dockerfile` (Next.js production build)

---

## 🐳 Docker Services

### Local Docker Stack

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d db redis minio

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Service Access Points

| Service | Local URL | Credentials |
|---------|-----------|-------------|
| PostgreSQL | `localhost:5432` | `postgres/postgres` |
| Redis | `localhost:6379` | No auth |
| MinIO | `localhost:9000` | `test-access-key/test-secret-key` |
| MinIO Console | `localhost:9001` | `test-access-key/test-secret-key` |

---

## 🔍 Troubleshooting

### Common Local Issues

**Docker services not starting:**
```bash
# Check Docker is running
docker info

# Restart Docker services
docker-compose down && docker-compose up -d
```

**Database connection issues:**
```bash
# Reset database
pnpm run reset:db

# Check database status
docker-compose exec db pg_isready -U postgres
```

**API client type errors:**
```bash
# Regenerate API types
pnpm run generate:api-types

# Rebuild API client
cd libs/api-client && pnpm build
```

### Common Railway Issues

**Deployment failures:**
```bash
# Check service status
railway status

# View deployment logs
railway logs --service <service-name>

# Redeploy specific service
railway service <service-name> && railway up
```

**Environment variable issues:**
```bash
# Check current variables
railway variables

# Reconfigure secrets
pnpm run deploy:secrets
```

---

## 📚 Additional Resources

- **API Documentation**: http://localhost:3000/api (local) or your Railway API domain
- **Prisma Studio**: `pnpm prisma:studio`
- **Railway Dashboard**: `railway open`
- **Project Structure**: See `nx.json` for workspace configuration
- **Environment Variables**: See `ENVIRONMENT_VARIABLES.md`

---

## 🎯 Quick Reference

| Task | Local Command | Railway Command |
|------|---------------|-----------------|
| **Setup** | `pnpm run setup:local` | `pnpm run deploy:railway` |
| **Start** | `pnpm run dev:full` | `railway up` |
| **Build** | `pnpm build` | Automatic via Dockerfile |
| **Logs** | `pnpm run logs:all` | `railway logs --service <name>` |
| **Database** | `pnpm prisma:studio` | `railway connect postgres` |
| **Status** | `docker-compose ps` | `railway status` |

---

**Happy coding! 🎉**
