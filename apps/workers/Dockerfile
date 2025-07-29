# Multi-stage build for Workers service
FROM node:20-alpine AS base

# Install FFmpeg and pnpm globally
RUN apk add --no-cache ffmpeg
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml ./

# Install dependencies (cached layer)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate
WORKDIR /app

# Build stage
RUN pnpm build:workers

# Production stage
FROM node:20-alpine AS production

# Install FFmpeg and pnpm
RUN apk add --no-cache ffmpeg
RUN npm install -g pnpm

WORKDIR /app

# Copy built application
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./

# Run as non-root user
USER node

# Start the application
CMD ["node", "dist/apps/workers/main.js"]
