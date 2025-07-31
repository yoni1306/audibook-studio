# FFmpeg Requirements for Workers Service

## 🚨 Critical Issue: Missing FFmpeg in Production

### Problem
Workers service fails in production with error:
```
Cannot find ffprobe
Error: Cannot find ffprobe
    at /app/node_modules/.pnpm/fluent-ffmpeg@2.1.3/node_modules/fluent-ffmpeg/lib/ffprobe.js:145:31
```

### Root Cause
The workers Docker image was missing FFmpeg installation, which is required for:
- Audio file processing
- Page audio combination
- Export functionality
- fluent-ffmpeg library operations

### Solution
Add FFmpeg installation to workers Dockerfile:

```dockerfile
# Install FFmpeg and pnpm globally
RUN apk add --no-cache ffmpeg
```

### Implementation
Must be added to BOTH stages of multi-stage Docker build:
1. **Base stage** - for build-time operations
2. **Production stage** - for runtime operations

### Complete Fix
```dockerfile
# Multi-stage build for Workers service
FROM node:20-alpine AS base

# Install FFmpeg and pnpm globally
RUN apk add --no-cache ffmpeg
RUN npm install -g pnpm

# ... rest of base stage

# Production stage
FROM node:20-alpine AS production

# Install FFmpeg and pnpm
RUN apk add --no-cache ffmpeg
RUN npm install -g pnpm

# ... rest of production stage
```

### Deployment
After fixing Dockerfile:
```bash
pnpm deploy:push:workers
```

### Prevention
- Always include FFmpeg in any service that processes audio
- Test audio processing functionality in staging before production
- Include FFmpeg availability check in health checks
- Document audio processing dependencies clearly

### Related Components
- `fluent-ffmpeg` library
- Page audio combination worker
- Export functionality
- Audio file processing pipeline

---
**Status**: ✅ Fixed in production
**Date**: 2025-07-29
**Impact**: Critical - Export feature completely broken without this
