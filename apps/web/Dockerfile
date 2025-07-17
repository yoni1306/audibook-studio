# Multi-stage build for Web service
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml ./

# Note: This is a monorepo with single root package.json
# Individual services don't have their own package.json files

# Install dependencies (cached layer)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build stage
RUN pnpm build:web

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy built application and dependencies
COPY --from=base /app/apps/web/dist ./apps/web/dist
COPY --from=base /app/apps/web/server.js ./apps/web/server.js
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Run as non-root user
USER nodejs

# Start the application
WORKDIR /app/apps/web
CMD ["pnpm", "start"]
