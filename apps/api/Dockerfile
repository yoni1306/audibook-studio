# Multi-stage build for API service
FROM node:20-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Note: This is a monorepo with single root package.json
# Individual services don't have their own package.json files

# Install dependencies (cached layer)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build stage
WORKDIR /app
RUN pnpm build:api

# Production stage
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy built application
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Copy Prisma schema and migrations for auto-migration
COPY --from=base /app/apps/api/prisma ./apps/api/prisma
# Prisma client is already included in the root node_modules copied above
# No need to copy separately as it's generated in root node_modules/.prisma

# Install prisma CLI in production for migrations (at root level for monorepo)
RUN pnpm add prisma --save-dev

# Copy start script that runs migrations before starting the app
COPY --from=base /app/apps/api/start.sh /app/start.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Create node user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app && \
    chmod +x /app/start.sh

# Run as non-root user
USER nodejs

# Start the application with migrations
CMD ["/app/start.sh"]